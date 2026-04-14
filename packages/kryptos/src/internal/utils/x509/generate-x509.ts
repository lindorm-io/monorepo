import { randomBytes } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosAlgorithm, KryptosType, X509SubjectAltNameInput } from "../../../types";
import {
  encodeBitString,
  encodeExplicitTag,
  encodeInteger,
  encodeSequence,
} from "../asn1";
import {
  encodeX509AlgorithmIdentifier,
  resolveSignatureDescriptor,
} from "./encode-algorithm-identifier";
import {
  authorityKeyIdentifierExt,
  basicConstraintsExt,
  keyUsageExt,
  subjectAlternativeNameExt,
  subjectKeyIdentifierExt,
  X509BasicConstraints,
  X509KeyUsageFlag,
} from "./encode-extensions";
import { encodeX509Name, X509NameInput } from "./encode-name";
import { encodeX509Validity } from "./encode-validity";
import { detectOkpCurve, signX509Tbs } from "./sign-tbs";
import { spkiFromPublicKey } from "./spki-from-public-key";

export type GenerateX509Options = {
  subjectKryptos: { publicKey: Buffer; type: KryptosType; algorithm: KryptosAlgorithm };
  issuerKryptos: { privateKey: Buffer; type: KryptosType; algorithm: KryptosAlgorithm };
  subject: X509NameInput;
  issuer: X509NameInput;
  notBefore: Date;
  notAfter: Date;
  basicConstraints: X509BasicConstraints;
  keyUsage: ReadonlyArray<X509KeyUsageFlag>;
  subjectAlternativeNames: ReadonlyArray<X509SubjectAltNameInput>;
  authorityKeyIdentifier?: Buffer;
  serialNumber?: Buffer;
};

const buildSerialNumber = (provided?: Buffer): Buffer => {
  if (provided !== undefined) {
    if (provided.length === 0) {
      throw new KryptosError("serialNumber must be non-empty");
    }
    return provided;
  }
  const bytes = randomBytes(16);
  bytes[0] &= 0x7f;
  if (bytes[0] === 0x00) bytes[0] = 0x01;
  return bytes;
};

const assertKeyUsageAgainstBasicConstraints = (
  keyUsage: ReadonlyArray<X509KeyUsageFlag>,
  basicConstraints: X509BasicConstraints,
): void => {
  if (keyUsage.length === 0) {
    throw new KryptosError("keyUsage must contain at least one flag (RFC 5280 §4.2.1.3)");
  }

  const needsCa = keyUsage.includes("keyCertSign") || keyUsage.includes("cRLSign");
  if (needsCa && !basicConstraints.ca) {
    throw new KryptosError(
      "keyUsage with keyCertSign or cRLSign requires basicConstraints.ca=true (RFC 5280 §4.2.1.3)",
    );
  }
};

const buildExtensions = (options: GenerateX509Options, subjectSpki: Buffer): Buffer => {
  const extensions: Array<Buffer> = [];

  extensions.push(basicConstraintsExt(options.basicConstraints));
  extensions.push(keyUsageExt(options.keyUsage));
  extensions.push(subjectKeyIdentifierExt(subjectSpki));

  if (options.authorityKeyIdentifier !== undefined) {
    extensions.push(authorityKeyIdentifierExt(options.authorityKeyIdentifier));
  }

  if (options.subjectAlternativeNames.length > 0) {
    extensions.push(subjectAlternativeNameExt(options.subjectAlternativeNames));
  }

  return encodeSequence(extensions);
};

export const generateX509Certificate = (options: GenerateX509Options): Buffer => {
  if (options.subjectKryptos.type === "oct" || options.issuerKryptos.type === "oct") {
    throw new KryptosError("X.509 certificates require asymmetric keys");
  }
  if (options.notBefore.getTime() >= options.notAfter.getTime()) {
    throw new KryptosError("notBefore must be strictly before notAfter");
  }

  assertKeyUsageAgainstBasicConstraints(options.keyUsage, options.basicConstraints);

  const subjectSpki = spkiFromPublicKey(
    options.subjectKryptos.publicKey,
    options.subjectKryptos.type,
  );

  const okpCurve = detectOkpCurve(
    options.issuerKryptos.privateKey,
    options.issuerKryptos.type,
  );
  const descriptor = resolveSignatureDescriptor({
    algorithm: options.issuerKryptos.algorithm,
    keyType: options.issuerKryptos.type,
    okpCurve,
  });
  const sigAlgId = encodeX509AlgorithmIdentifier(descriptor);

  const serial = buildSerialNumber(options.serialNumber);

  const extensions = buildExtensions(options, subjectSpki);

  const tbs = encodeSequence([
    encodeExplicitTag(0, encodeInteger(Buffer.from([0x02]))),
    encodeInteger(serial),
    sigAlgId,
    encodeX509Name(options.issuer),
    encodeX509Validity(options.notBefore, options.notAfter),
    encodeX509Name(options.subject),
    subjectSpki,
    encodeExplicitTag(3, extensions),
  ]);

  const signature = signX509Tbs({
    tbsBytes: tbs,
    privateKey: options.issuerKryptos.privateKey,
    keyType: options.issuerKryptos.type,
    descriptor,
  });

  const signatureBitString = encodeBitString(signature, 0);

  return encodeSequence([tbs, sigAlgId, signatureBitString]);
};
