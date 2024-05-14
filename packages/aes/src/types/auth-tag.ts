import { ShaAlgorithm } from "@lindorm/types";
import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesEncryption } from "./types";

export type GetAuthTagOptions = {
  cipher: Cipher | CipherGCM;
  content: Buffer;
  encryption: AesEncryption;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
};

export type SetAuthTagOptions = {
  authTag?: Buffer;
  content: Buffer;
  decipher: Decipher | DecipherGCM;
  decryptionKey: Buffer;
  encryption: AesEncryption;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash: ShaAlgorithm;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
