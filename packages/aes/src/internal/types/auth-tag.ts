import type { KryptosEncryption } from "@lindorm/kryptos";
import type { Cipheriv, Decipheriv } from "crypto";
import { type CipherGCM, type DecipherGCM } from "crypto";

export type GetAuthTagOptions = {
  aad?: Buffer;
  cipher: Cipheriv | CipherGCM;
  content: Buffer;
  hashKey: Buffer;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
};

export type SetAuthTagOptions = {
  aad?: Buffer;
  authTag?: Buffer;
  content: Buffer;
  hashKey: Buffer;
  decipher: Decipheriv | DecipherGCM;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
};

export type CreateHmacAuthTag = {
  aad?: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hashKey: Buffer;
  initialisationVector: Buffer;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
