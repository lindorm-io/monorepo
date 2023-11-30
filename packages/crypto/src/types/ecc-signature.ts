export type EccSignatureAlgorithm = "SHA256" | "SHA384" | "SHA512";

export type EccSignatureFormat = "base64" | "hex";

export type EccSignatureKey = string | { key: string };

export type CreateEccSignatureOptions = {
  algorithm?: EccSignatureAlgorithm;
  data: string;
  format?: EccSignatureFormat;
  key: EccSignatureKey;
};

export type VerifyEccSignatureOptions = {
  algorithm?: EccSignatureAlgorithm;
  data: string;
  format?: EccSignatureFormat;
  key: EccSignatureKey;
  signature: string;
};
