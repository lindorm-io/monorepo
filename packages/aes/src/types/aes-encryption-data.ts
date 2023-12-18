import { AesAlgorithm, AesEncryptionKeyAlgorithm } from "../enums";
import { AesCipherFormat } from "./aes";

export type AesEncryptionData = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format: AesCipherFormat;
  initialisationVector: Buffer;
  keyId?: Buffer;
  publicEncryptionKey?: Buffer;
  version: number;
};
