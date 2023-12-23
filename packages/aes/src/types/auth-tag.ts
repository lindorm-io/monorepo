import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesAlgorithm, AesIntegrityHash } from "../enums";

export type GetAuthTagOptions = {
  algorithm: AesAlgorithm;
  cipher: Cipher | CipherGCM;
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash?: AesIntegrityHash;
};

export type SetAuthTagOptions = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  decipher: Decipher | DecipherGCM;
  decryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash?: AesIntegrityHash;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash: AesIntegrityHash;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
