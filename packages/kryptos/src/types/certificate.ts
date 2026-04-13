import type { IKryptos } from "../interfaces/Kryptos";
import type { X509SubjectAltNameInput } from "./x509";

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

export type KryptosCertificateOption =
  | KryptosCertificateSelfSignedOption
  | KryptosCertificateRootCaOption
  | KryptosCertificateCaSignedOption;
