import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionMode = "encoded" | "record" | "serialised" | "tokenised";

export type AesEncryptionOptions = {
  data: Buffer | string;
  encryption?: KryptosEncryption;
};

export type AesDecryptionRecord = {
  algorithm?: KryptosAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hkdfSalt?: Buffer;
  initialisationVector: Buffer;
  keyId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
  version?: number;
};

export type SerialisedAesDecryption = {
  algorithm?: KryptosAlgorithm;
  authTag?: string;
  content: string;
  encryption: KryptosEncryption;
  hkdfSalt?: string;
  initialisationVector: string;
  keyId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: string;
  publicEncryptionIv?: string;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: string;
  publicEncryptionTag?: string;
  version?: number;
};
