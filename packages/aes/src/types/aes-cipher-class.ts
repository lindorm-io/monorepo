import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat } from "../enums";
import { AesEncryptionKey, AesSecret } from "./types";

export type AesCipherOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};
