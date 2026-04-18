import { KryptosError } from "../../errors";
import {
  KryptosAlgorithm,
  KryptosCertificateOption,
  KryptosCurve,
  KryptosType,
  KryptosUse,
  X509SubjectAltNameInput,
} from "../../types";
import { computeSpkiKeyIdentifier } from "./x509/compute-spki-key-identifier";
import { X509KeyUsageFlag } from "./x509/encode-extensions";
import { X509NameInput } from "./x509/encode-name";
import { generateX509Certificate } from "./x509/generate-x509";
import { resolveSignAlgorithmForCert } from "./resolve-sign-algorithm";

type StampInput = {
  certificate: KryptosCertificateOption;
  subjectKryptos: {
    id: string;
    issuer: string | null;
    notBefore: Date;
    expiresAt: Date;
    use: KryptosUse;
    type: KryptosType;
    algorithm: KryptosAlgorithm;
    curve: KryptosCurve | null;
    publicKey: Buffer;
    privateKey?: Buffer;
  };
  serialNumber?: Buffer;
};

const isUrl = (value: string): boolean => {
  try {
    new URL(value);
    return true;
  } catch {
    return false;
  }
};

const deriveSan = (issuer: string | null, id: string): string => {
  if (!issuer) return `urn:lindorm:kryptos:${id}`;
  if (isUrl(issuer)) return issuer;
  throw new KryptosError(
    "Cannot derive SAN from non-URL issuer; supply explicit subjectAlternativeNames or use a URL-shaped issuer",
    { data: { issuer } },
  );
};

const resolveSubject = (
  option: KryptosCertificateOption,
  issuer: string | null,
  id: string,
): { commonName: string; organization?: string } => ({
  commonName: option.subject ?? issuer ?? id,
  ...(option.organization !== undefined ? { organization: option.organization } : {}),
});

const normalizeSan = (
  entry: string | X509SubjectAltNameInput,
): X509SubjectAltNameInput =>
  typeof entry === "string" ? { type: "uri", value: entry } : entry;

const resolveSans = (
  option: KryptosCertificateOption,
  issuer: string | null,
  id: string,
): ReadonlyArray<X509SubjectAltNameInput> => {
  if (option.subjectAlternativeNames && option.subjectAlternativeNames.length > 0) {
    return option.subjectAlternativeNames.map(normalizeSan);
  }
  return [{ type: "uri", value: deriveSan(issuer, id) }];
};

const keyUsageForUse = (use: KryptosUse): ReadonlyArray<X509KeyUsageFlag> =>
  use === "sig" ? ["digitalSignature"] : ["keyEncipherment", "dataEncipherment"];

export const stampCertificate = (input: StampInput): Array<string> => {
  const { certificate, subjectKryptos } = input;

  if (subjectKryptos.type === "oct") {
    throw new KryptosError("symmetric keys cannot have certificates");
  }

  if (subjectKryptos.type === "AKP") {
    throw new KryptosError("AKP keys do not yet support certificates");
  }

  if (!subjectKryptos.privateKey) {
    throw new KryptosError(
      "certificate generation requires the generated kryptos to have a private key",
    );
  }

  const subjectName: X509NameInput = resolveSubject(
    certificate,
    subjectKryptos.issuer,
    subjectKryptos.id,
  );
  const sans = resolveSans(certificate, subjectKryptos.issuer, subjectKryptos.id);

  const subjectKryptosSig = {
    publicKey: subjectKryptos.publicKey,
    type: subjectKryptos.type,
    algorithm: subjectKryptos.algorithm,
  };

  if (certificate.mode === "self-signed") {
    const signAlgorithm = resolveSignAlgorithmForCert({
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
      curve: subjectKryptos.curve,
    });

    const ownSki = computeSpkiKeyIdentifier(
      subjectKryptos.publicKey,
      subjectKryptos.type,
    );

    const der = generateX509Certificate({
      subjectKryptos: subjectKryptosSig,
      issuerKryptos: {
        privateKey: subjectKryptos.privateKey,
        type: subjectKryptos.type,
        algorithm: signAlgorithm,
      },
      subject: subjectName,
      issuer: subjectName,
      notBefore: subjectKryptos.notBefore,
      notAfter: subjectKryptos.expiresAt,
      basicConstraints: { ca: false },
      keyUsage: keyUsageForUse(subjectKryptos.use),
      subjectAlternativeNames: sans,
      authorityKeyIdentifier: ownSki,
      ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
    });

    return [der.toString("base64")];
  }

  if (certificate.mode === "root-ca") {
    const signAlgorithm = resolveSignAlgorithmForCert({
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
      curve: subjectKryptos.curve,
    });

    const der = generateX509Certificate({
      subjectKryptos: subjectKryptosSig,
      issuerKryptos: {
        privateKey: subjectKryptos.privateKey,
        type: subjectKryptos.type,
        algorithm: signAlgorithm,
      },
      subject: subjectName,
      issuer: subjectName,
      notBefore: subjectKryptos.notBefore,
      notAfter: subjectKryptos.expiresAt,
      basicConstraints: {
        ca: true,
        ...(certificate.pathLengthConstraint !== undefined
          ? { pathLengthConstraint: certificate.pathLengthConstraint }
          : {}),
      },
      keyUsage: ["keyCertSign", "cRLSign"],
      subjectAlternativeNames: sans,
      ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
    });

    return [der.toString("base64")];
  }

  const ca = certificate.ca;

  if (!ca.hasPrivateKey) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a private key");
  }

  if (!ca.hasCertificate || !ca.certificateChain || !ca.certificate) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a certificate");
  }

  const caLeaf = ca.certificate;

  if (!caLeaf.extensions.basicConstraintsCa) {
    throw new KryptosError(
      "ca-signed requires CA kryptos whose leaf cert has basicConstraints cA=true",
    );
  }

  const caSki = caLeaf.extensions.subjectKeyIdentifier;
  if (!caSki) {
    throw new KryptosError(
      "ca-signed requires CA leaf certificate with a subjectKeyIdentifier extension",
    );
  }

  if (!caLeaf.extensions.keyUsage.includes("keyCertSign")) {
    throw new KryptosError(
      "ca-signed requires CA leaf certificate with keyCertSign in keyUsage",
    );
  }

  if (
    subjectKryptos.notBefore.getTime() < caLeaf.notBefore.getTime() ||
    subjectKryptos.expiresAt.getTime() > caLeaf.notAfter.getTime()
  ) {
    throw new KryptosError(
      "ca-signed child validity window must fit within the CA's validity window",
    );
  }

  const caDer = ca.export("der");
  if (!caDer.privateKey) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a private key");
  }

  const caSignAlgorithm = resolveSignAlgorithmForCert({
    type: ca.type,
    algorithm: ca.algorithm,
    curve: ca.curve,
  });

  const der = generateX509Certificate({
    subjectKryptos: subjectKryptosSig,
    issuerKryptos: {
      privateKey: caDer.privateKey,
      type: ca.type,
      algorithm: caSignAlgorithm,
    },
    subject: subjectName,
    issuer: { raw: caLeaf.subject.raw },
    notBefore: subjectKryptos.notBefore,
    notAfter: subjectKryptos.expiresAt,
    basicConstraints: { ca: false },
    keyUsage: keyUsageForUse(subjectKryptos.use),
    subjectAlternativeNames: sans,
    authorityKeyIdentifier: caSki,
    ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
  });

  return [der.toString("base64"), ...ca.certificateChain];
};
