import { KryptosEncryption } from "@lindorm/kryptos";
import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";

export type GetAuthTagOptions = {
  cipher: Cipher | CipherGCM;
  content: Buffer;
  hashKey: Buffer;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
};

export type SetAuthTagOptions = {
  authTag?: Buffer;
  content: Buffer;
  hashKey: Buffer;
  decipher: Decipher | DecipherGCM;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
};

export type CreateHmacAuthTag = {
  content: Buffer;
  encryption: KryptosEncryption;
  hashKey: Buffer;
  initialisationVector: Buffer;
};

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
