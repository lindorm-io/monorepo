import {
  BufferFormat,
  Encryption,
  EncryptionKeyAlgorithm,
  IntegrityHash,
  PublicEncryptionJwk,
} from "./types";

export type AesEncryptionData = {
  authTag: Buffer | undefined;
  content: Buffer;
  encryption: Encryption;
  encryptionKeyAlgorithm: EncryptionKeyAlgorithm | undefined;
  format: BufferFormat;
  initialisationVector: Buffer;
  integrityHash: IntegrityHash | undefined;
  keyId: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  version: number;
};
