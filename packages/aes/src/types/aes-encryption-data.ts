import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";

export type AesEncryptionData = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format: AesFormat;
  initialisationVector: Buffer;
  integrityAlgorithm?: AesIntegrityAlgorithm;
  keyId?: Buffer;
  publicEncryptionKey?: Buffer;
  version: number;
};
