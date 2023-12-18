import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "@lindorm-io/aes";

export type JweOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  key: string;
};

export type EncryptJweOptions = {
  algorithm?: AesAlgorithm;
  key: string;
  keyId?: string;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  token: string;
};

export type DecryptJweOptions = {
  jwe: string;
  key: string;
};
