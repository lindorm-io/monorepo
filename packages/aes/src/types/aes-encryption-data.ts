import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionData = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hkdfSalt: Buffer | undefined;
  initialisationVector: Buffer;
  keyId: Buffer;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: number;
};
