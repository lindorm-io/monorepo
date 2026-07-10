import type { IKryptos } from "../interfaces/Kryptos.js";
import type { X509SubjectAltNameInput } from "./x509.js";

export type KryptosCertificateSelfSignedOption = {
  mode: "self-signed";
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
};

export type KryptosCertificateRootCaOption = {
  mode: "root-ca";
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
  pathLengthConstraint?: number;
};

export type KryptosCertificateCaSignedOption = {
  mode: "ca-signed";
  ca: IKryptos;
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
};

// An intermediate CA: signed by `ca` (like ca-signed) but itself a CA
// (basicConstraints cA=true) that can sign further certificates. RFC 5280
// §4.2.1.9.
export type KryptosCertificateIntermediateCaOption = {
  mode: "intermediate-ca";
  ca: IKryptos;
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
  pathLengthConstraint?: number;
};

export type KryptosCertificateOption =
  | KryptosCertificateSelfSignedOption
  | KryptosCertificateRootCaOption
  | KryptosCertificateCaSignedOption
  | KryptosCertificateIntermediateCaOption;
