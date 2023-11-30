export type RsaSignatureAlgorithm =
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "SHA256"
  | "SHA384"
  | "SHA512";

export type RsaSignatureFormat = "base64" | "hex";

export type RsaSignatureKey = string | { key: string; passphrase: string };

export type CreateRsaSignatureOptions = {
  algorithm?: RsaSignatureAlgorithm;
  data: string;
  format?: RsaSignatureFormat;
  key: RsaSignatureKey;
};

export type VerifyRsaSignatureOptions = {
  algorithm?: RsaSignatureAlgorithm;
  data: string;
  format?: RsaSignatureFormat;
  key: RsaSignatureKey;
  signature: string;
};
