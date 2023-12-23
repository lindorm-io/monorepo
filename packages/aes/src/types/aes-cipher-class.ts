import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat, AesIntegrityHash } from "../enums";
import { AesEncryptionKey, AesSecret } from "./types";

export type AesCipherOptions = {
  algorithm?: AesAlgorithm;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  integrityHash?: AesIntegrityHash;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};
