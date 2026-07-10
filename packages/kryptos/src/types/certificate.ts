import type { Environment } from "@lindorm/types";
import type { IKryptos } from "../interfaces/Kryptos.js";
import type { X509SubjectAltNameInput } from "./x509.js";

// When set, `environment` is stamped as the certificate subject's OU
// (organizationalUnitName) DN attribute. It lives ONLY on certificates — never
// as a key attribute, JWK member, CBOR label, or DB column.
export type KryptosCertificateSelfSignedOption = {
  mode: "self-signed";
  subject?: string;
  organization?: string;
  environment?: Environment;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
};

export type KryptosCertificateRootCaOption = {
  mode: "root-ca";
  subject?: string;
  organization?: string;
  environment?: Environment;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
  pathLengthConstraint?: number;
};

export type KryptosCertificateCaSignedOption = {
  mode: "ca-signed";
  ca: IKryptos;
  subject?: string;
  organization?: string;
  environment?: Environment;
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
  environment?: Environment;
  subjectAlternativeNames?: Array<string | X509SubjectAltNameInput>;
  pathLengthConstraint?: number;
};

export type KryptosCertificateOption =
  | KryptosCertificateSelfSignedOption
  | KryptosCertificateRootCaOption
  | KryptosCertificateCaSignedOption
  | KryptosCertificateIntermediateCaOption;
