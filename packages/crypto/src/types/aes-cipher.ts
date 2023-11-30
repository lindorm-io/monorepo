export type AesCipherAlgorithm = "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";

export type AesCipherFormat = "base64" | "hex";

export type EncryptAesCipherOptions = {
  algorithm?: AesCipherAlgorithm;
  format?: AesCipherFormat;
  data: string;
  secret: string;
};

export type DecryptAesCipherOptions = {
  algorithm?: AesCipherAlgorithm;
  cipher: string;
  format?: AesCipherFormat;
  secret: string;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
