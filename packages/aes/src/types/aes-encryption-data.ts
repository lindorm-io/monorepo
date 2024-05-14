import { BufferFormat, ShaAlgorithm } from "@lindorm/types";
import { AesEncryption, AesEncryptionKeyAlgorithm, PublicEncryptionJwk } from "./types";

export type AesEncryptionData = {
  authTag: Buffer | undefined;
  content: Buffer;
  encryption: AesEncryption;
  encryptionKeyAlgorithm: AesEncryptionKeyAlgorithm | undefined;
  format: BufferFormat;
  initialisationVector: Buffer;
  integrityHash: ShaAlgorithm | undefined;
  keyId: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  version: number;
};
