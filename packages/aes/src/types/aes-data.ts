import { AesEncryptionKeyAlgorithm } from "../enums";
import { AesCipherAlgorithm, AesCipherKey } from "./aes";

export type DecryptAesDataOptions = {
  algorithm: AesCipherAlgorithm;
  authTag: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  key?: AesCipherKey;
  publicEncryptionKey?: Buffer;
  secret?: string;
};
