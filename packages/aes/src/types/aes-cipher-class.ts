import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesCipherKey } from "./aes";

export type AesCipherOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  key?: AesCipherKey;
  secret?: string;
};
