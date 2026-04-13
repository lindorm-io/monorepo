import { KryptosError } from "../../errors";
import { IKryptos } from "../../interfaces";
import { KryptosAlgorithm, KryptosCurve, KryptosType, KryptosUse } from "../../types";
import { generateX509Certificate } from "./x509/generate-x509";
import { X509NameInput } from "./x509/encode-name";
import { resolveSignAlgorithmForCert } from "./resolve-sign-algorithm";

export type CertificateOption =
  | {
      mode: "self-signed";
      subject?: string;
      organization?: string;
      subjectAlternativeNames?: ReadonlyArray<string>;
    }
  | {
      mode: "ca-signed";
      ca: IKryptos;
      subject?: string;
      organization?: string;
      subjectAlternativeNames?: ReadonlyArray<string>;
    };

type StampInput = {
  certificate: CertificateOption;
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
  if (issuer && isUrl(issuer)) return issuer;
  return `urn:lindorm:kryptos:${id}`;
};

const resolveSubject = (
  option: CertificateOption,
  issuer: string | null,
  id: string,
): X509NameInput => ({
  commonName: option.subject ?? issuer ?? id,
  ...(option.organization !== undefined ? { organization: option.organization } : {}),
});

const resolveSans = (
  option: CertificateOption,
  issuer: string | null,
  id: string,
): ReadonlyArray<string> => {
  if (option.subjectAlternativeNames && option.subjectAlternativeNames.length > 0) {
    return option.subjectAlternativeNames;
  }
  return [deriveSan(issuer, id)];
};

const parsedNameToInput = (name: {
  commonName?: string;
  organization?: string;
}): X509NameInput => {
  if (!name.commonName) {
    throw new KryptosError("CA certificate subject has no commonName");
  }
  return {
    commonName: name.commonName,
    ...(name.organization !== undefined ? { organization: name.organization } : {}),
  };
};

export const stampCertificate = (input: StampInput): Array<string> => {
  const { certificate, subjectKryptos } = input;

  if (subjectKryptos.type === "oct") {
    throw new KryptosError("symmetric keys cannot have certificates");
  }

  const subjectName = resolveSubject(
    certificate,
    subjectKryptos.issuer,
    subjectKryptos.id,
  );
  const sans = resolveSans(certificate, subjectKryptos.issuer, subjectKryptos.id);

  if (certificate.mode === "self-signed") {
    if (!subjectKryptos.privateKey) {
      throw new KryptosError(
        "self-signed mode requires the generated kryptos to have a private key",
      );
    }

    const signAlgorithm = resolveSignAlgorithmForCert({
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
      curve: subjectKryptos.curve,
    });

    const der = generateX509Certificate({
      subjectKryptos: {
        publicKey: subjectKryptos.publicKey,
        type: subjectKryptos.type,
        algorithm: subjectKryptos.algorithm,
      },
      issuerKryptos: {
        privateKey: subjectKryptos.privateKey,
        type: subjectKryptos.type,
        algorithm: signAlgorithm,
      },
      subject: subjectName,
      issuer: subjectName,
      notBefore: subjectKryptos.notBefore,
      notAfter: subjectKryptos.expiresAt,
      keyUsage: subjectKryptos.use,
      subjectAlternativeNames: sans,
      ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
    });

    return [der.toString("base64")];
  }

  // ca-signed
  const ca = certificate.ca;

  if (!ca.hasPrivateKey) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a private key");
  }

  if (!ca.certificateChain || ca.certificateChain.length === 0 || !ca.x5c) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a certificateChain");
  }

  const caLeaf = ca.certificateChain[0];
  const caAki = caLeaf.extensions.subjectKeyIdentifier;

  if (!caAki) {
    throw new KryptosError(
      "ca-signed mode requires CA leaf certificate with a subjectKeyIdentifier extension",
    );
  }

  const caDer = ca.export("der");
  if (!caDer.privateKey) {
    throw new KryptosError("ca-signed mode requires CA kryptos with a private key");
  }
  if (ca.type === "oct") {
    throw new KryptosError("ca-signed mode cannot use a symmetric CA kryptos");
  }

  const caSignAlgorithm = resolveSignAlgorithmForCert({
    type: ca.type,
    algorithm: ca.algorithm,
    curve: ca.curve,
  });

  const issuerName = parsedNameToInput(caLeaf.subject);

  const der = generateX509Certificate({
    subjectKryptos: {
      publicKey: subjectKryptos.publicKey,
      type: subjectKryptos.type,
      algorithm: subjectKryptos.algorithm,
    },
    issuerKryptos: {
      privateKey: caDer.privateKey,
      type: ca.type,
      algorithm: caSignAlgorithm,
    },
    subject: subjectName,
    issuer: issuerName,
    notBefore: subjectKryptos.notBefore,
    notAfter: subjectKryptos.expiresAt,
    keyUsage: subjectKryptos.use,
    subjectAlternativeNames: sans,
    authorityKeyIdentifier: caAki,
    ...(input.serialNumber ? { serialNumber: input.serialNumber } : {}),
  });

  return [der.toString("base64"), ...ca.x5c];
};
