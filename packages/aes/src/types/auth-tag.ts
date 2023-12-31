import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { Encryption, IntegrityHash } from "./types";

export type GetAuthTagOptions = {
  cipher: Cipher | CipherGCM;
  content: Buffer;
  encryption: Encryption;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash?: IntegrityHash;
};

export type SetAuthTagOptions = {
  authTag?: Buffer;
  content: Buffer;
  decipher: Decipher | DecipherGCM;
  decryptionKey: Buffer;
  encryption: Encryption;
  initialisationVector: Buffer;
  integrityHash?: IntegrityHash;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
  integrityHash: IntegrityHash;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
