import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesEncryptionKey } from "./aes-encryption-key";

export type AesCipherOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  key?: AesEncryptionKey;
  secret?: string;
};
