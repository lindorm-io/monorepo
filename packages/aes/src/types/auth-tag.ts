import { ShaAlgorithm } from "@lindorm/types";
import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesEncryption } from "./types";

export type GetAuthTagOptions = {
  cipher: Cipher | CipherGCM;
  content: Buffer;
  contentEncryptionKey: Buffer;
  encryption: AesEncryption;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
};

export type SetAuthTagOptions = {
  authTag?: Buffer;
  content: Buffer;
  contentEncryptionKey: Buffer;
  decipher: Decipher | DecipherGCM;
  encryption: AesEncryption;
  initialisationVector: Buffer;
  integrityHash?: ShaAlgorithm;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  contentEncryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash: ShaAlgorithm;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
