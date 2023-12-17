import { RsaOaepHash } from "../enums";
import { AesCipherAlgorithm, AesCipherFormat } from "./aes-cipher";

export type AesEncryptionData = {
  algorithm: AesCipherAlgorithm;
  authTag: Buffer;
  encryption: Buffer;
  format: AesCipherFormat;
  initialisationVector: Buffer;
  keyHash?: RsaOaepHash;
  keyId?: Buffer;
  publicEncryptionKey?: Buffer;
  version: number;
};
