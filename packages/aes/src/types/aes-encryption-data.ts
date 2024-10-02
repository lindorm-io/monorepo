import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionData = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hkdfSalt: Buffer | undefined;
  initialisationVector: Buffer;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: number;
};

export type AesEncryptionDataEncoded = {
  algorithm: KryptosAlgorithm;
  authTag: string;
  content: string;
  encryption: KryptosEncryption;
  hkdfSalt: string | undefined;
  initialisationVector: string;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: string | undefined;
  publicEncryptionIv: string | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: string | undefined;
  publicEncryptionTag: string | undefined;
  version: number;
};
