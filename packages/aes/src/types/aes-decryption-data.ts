import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesContentType } from "./content";
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
  contentType?: AesContentType;
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
  contentType?: AesContentType;
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
