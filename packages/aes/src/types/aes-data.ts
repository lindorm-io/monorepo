import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";
import { AesEncryptionKey, AesSecret } from "./aes-encryption-key";

export type EncryptAesDataOptions = {
  algorithm?: AesAlgorithm;
  data: Buffer | string;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  integrityAlgorithm?: AesIntegrityAlgorithm;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};

export type DecryptAesDataOptions = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  integrityAlgorithm?: AesIntegrityAlgorithm;
  key?: AesEncryptionKey;
  publicEncryptionKey?: Buffer;
  secret?: AesSecret;
};
