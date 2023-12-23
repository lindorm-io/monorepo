import { AesAlgorithm, AesEncryptionKeyAlgorithm, AesFormat, AesIntegrityHash } from "../enums";
import { AesPublicJwk } from "./types";

export type AesEncryptionData = {
  algorithm: AesAlgorithm;
  authTag: Buffer | undefined;
  content: Buffer;
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm | undefined;
  format: AesFormat;
  initialisationVector: Buffer;
  integrityHash: AesIntegrityHash | undefined;
  keyId: Buffer | undefined;
  publicEncryptionJwk: AesPublicJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  version: number;
};
