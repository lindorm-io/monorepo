import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat, AesIntegrityHash } from "../enums";
import { AesEncryptionKey, AesPublicJwk, AesSecret } from "./types";

export type EncryptAesDataOptions = {
  algorithm?: AesAlgorithm;
  data: Buffer | string;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  integrityHash?: AesIntegrityHash;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};

export type DecryptAesDataOptions = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  integrityHash?: AesIntegrityHash;
  key?: AesEncryptionKey;
  publicEncryptionJwk?: AesPublicJwk;
  publicEncryptionKey?: Buffer;
  secret?: AesSecret;
};
