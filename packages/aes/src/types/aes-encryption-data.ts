import { AesEncryptionKeyAlgorithm } from "../enums";
import { AesCipherAlgorithm, AesCipherFormat } from "./aes";

export type AesEncryptionData = {
  algorithm: AesCipherAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format: AesCipherFormat;
  initialisationVector: Buffer;
  keyId?: Buffer;
  publicEncryptionKey?: Buffer;
  version: number;
};
