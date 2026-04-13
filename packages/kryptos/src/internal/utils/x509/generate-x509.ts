import { randomBytes } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosAlgorithm, KryptosType } from "../../../types";
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
  keyUsage: "sig" | "enc";
  subjectAlternativeNames: ReadonlyArray<string>;
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
  // Clear the top bit to stay a positive integer after DER's two-complement
  // normalization. Ensures we don't need encodeInteger's sign-extension byte.
  bytes[0] &= 0x7f;
  if (bytes[0] === 0x00) bytes[0] = 0x01;
  return bytes;
};

const buildExtensions = (
  options: GenerateX509Options,
  subjectSpki: Buffer,
  isSelfSigned: boolean,
): Buffer => {
  const extensions: Array<Buffer> = [];

  extensions.push(basicConstraintsExt(isSelfSigned));

  if (options.keyUsage === "sig") {
    extensions.push(
      keyUsageExt({
        digitalSignature: true,
        ...(isSelfSigned ? { keyCertSign: true, crlSign: true } : {}),
      }),
    );
  } else {
    extensions.push(keyUsageExt({ keyEncipherment: true, dataEncipherment: true }));
  }

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
  if (options.notBefore.getTime() > options.notAfter.getTime()) {
    throw new KryptosError("notBefore must be <= notAfter");
  }

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

  const isSelfSigned = options.authorityKeyIdentifier === undefined;

  const extensions = buildExtensions(options, subjectSpki, isSelfSigned);

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
