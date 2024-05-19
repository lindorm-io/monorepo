import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { BufferFormat } from "@lindorm/types";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionData = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  format: BufferFormat;
  hkdfSalt: Buffer | undefined;
  initialisationVector: Buffer;
  keyId: Buffer;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  version: number;
};
