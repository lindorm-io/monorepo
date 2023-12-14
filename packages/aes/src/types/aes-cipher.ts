import { AesAlgorithm, AesFormat } from "../enums";

export type AesCipherAlgorithm = "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";

export type AesCipherFormat = "base64" | "base64url" | "hex";

export type AesCipherKey = string | { key: string; passphrase: string };

export type EncryptAesCipherOptions = {
  algorithm?: AesAlgorithm;
  data: string;
  format?: AesFormat;
  key?: AesCipherKey;
  secret?: string;
};

export type DecryptAesCipherOptions = {
  cipher: string;
  key?: AesCipherKey;
  secret?: string;
};

export type VerifyAesCipherOptions = DecryptAesCipherOptions & {
  data: string;
};
