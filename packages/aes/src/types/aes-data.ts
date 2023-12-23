import { EcJwkValues } from "@lindorm-io/jwk";
import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";
import { AesEncryptionKey, AesPublicJwk, AesSecret } from "./types";

export type EncryptAesDataOptions = {
  algorithm?: AesAlgorithm;
  data: Buffer | string;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  format?: AesFormat;
  integrityAlgorithm?: AesIntegrityAlgorithm;
  key?: AesEncryptionKey;
  secret?: AesSecret;
};

export type DecryptAesDataOptions = {
  algorithm: AesAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryptionKeyAlgorithm?: AesEncryptionKeyAlgorithm;
  initialisationVector: Buffer;
  integrityAlgorithm?: AesIntegrityAlgorithm;
  key?: AesEncryptionKey;
  publicEncryptionJwk?: AesPublicJwk;
  publicEncryptionKey?: Buffer;
  secret?: AesSecret;
};
