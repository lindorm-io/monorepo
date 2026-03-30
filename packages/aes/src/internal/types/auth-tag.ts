import { KryptosEncryption } from "@lindorm/kryptos";
import { CipherGCM, Cipheriv, DecipherGCM, Decipheriv } from "crypto";

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
