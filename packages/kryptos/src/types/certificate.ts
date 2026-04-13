import type { IKryptos } from "../interfaces/Kryptos";

export type KryptosCertificateSelfSignedOption = {
  mode: "self-signed";
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: ReadonlyArray<string>;
};

export type KryptosCertificateRootCaOption = {
  mode: "root-ca";
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: ReadonlyArray<string>;
  pathLengthConstraint?: number;
};

export type KryptosCertificateCaSignedOption = {
  mode: "ca-signed";
  ca: IKryptos;
  subject?: string;
  organization?: string;
  subjectAlternativeNames?: ReadonlyArray<string>;
};

export type KryptosCertificateOption =
  | KryptosCertificateSelfSignedOption
  | KryptosCertificateRootCaOption
  | KryptosCertificateCaSignedOption;
