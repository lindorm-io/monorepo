import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesAlgorithm, AesIntegrityAlgorithm } from "../enums";

export type GetAuthTagOptions = {
  algorithm: AesAlgorithm;
  cipher: Cipher | CipherGCM;
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityAlgorithm?: AesIntegrityAlgorithm;
};

export type SetAuthTagOptions = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  decipher: Decipher | DecipherGCM;
  decryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityAlgorithm?: AesIntegrityAlgorithm;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityAlgorithm: AesIntegrityAlgorithm;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
