import { KryptosEncryption } from "@lindorm/kryptos";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionMode = "encoded" | "record" | "serialised" | "tokenised";

export type AesEncryptionOptions = {
  data: Buffer | string;
  encryption?: KryptosEncryption;
};

export type AesDecryptionRecord = {
  authTag?: Buffer;
  content: Buffer;
  encryption: KryptosEncryption;
  hkdfSalt?: Buffer;
  initialisationVector: Buffer;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
};

export type SerialisedAesDecryption = {
  authTag?: string;
  content: string;
  encryption: KryptosEncryption;
  hkdfSalt?: string;
  initialisationVector: string;
  pbkdfIterations?: number;
  pbkdfSalt?: string;
  publicEncryptionIv?: string;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: string;
  publicEncryptionTag?: string;
};
