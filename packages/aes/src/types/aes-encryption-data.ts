import {
  AesAlgorithm,
  AesEncryptionKeyAlgorithm,
  AesFormat,
  AesIntegrityAlgorithm,
} from "../enums";
import { AesPublicJwk } from "./types";

export type AesEncryptionData = {
  algorithm: AesAlgorithm;
  authTag: Buffer | undefined;
  content: Buffer;
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm | undefined;
  format: AesFormat;
  initialisationVector: Buffer;
  integrityAlgorithm: AesIntegrityAlgorithm | undefined;
  keyId: Buffer | undefined;
  publicEncryptionJwk: AesPublicJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  version: number;
};
