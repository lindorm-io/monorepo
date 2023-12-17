import { AesCipherAlgorithm, AesCipherFormat } from "./aes-cipher";

export type BuildAesString = {
  algorithm: AesCipherAlgorithm;
  authTag: Buffer;
  encryption: Buffer;
  format: AesCipherFormat;
  initialisationVector: Buffer;
  keyId?: Buffer;
  publicEncryptionKey?: Buffer;
  version: number;
};
