import { Cipher, CipherGCM, Decipher, DecipherGCM } from "crypto";
import { AesCipherAlgorithm } from "./aes";

export type GetAuthTagOptions = {
  algorithm: AesCipherAlgorithm;
  cipher: Cipher | CipherGCM;
  content: Buffer;
  encryptionKey: Buffer;
  initialisationVector: Buffer;
};

export type SetAuthTagOptions = {
  algorithm: AesCipherAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  decipher: Decipher | DecipherGCM;
  decryptionKey: Buffer;
  initialisationVector: Buffer;
};

export type CreateHmacAuthTag = Pick<
  GetAuthTagOptions,
  "content" | "encryptionKey" | "initialisationVector"
>;

export type VerifyHmacAuthTag = CreateHmacAuthTag & { authTag: Buffer };
