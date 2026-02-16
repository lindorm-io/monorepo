import { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import { AesContent, AesContentType } from "./content";
import { PublicEncryptionJwk } from "./types";

export type AesEncryptionMode = "encoded" | "record" | "serialised" | "tokenised";

export type AesEncryptionOptions = {
  aad?: Buffer;
  data: AesContent;
  encryption?: KryptosEncryption;
};

export type AesDecryptionRecord = {
  algorithm?: KryptosAlgorithm;
  authTag?: Buffer;
  content: Buffer;
  contentType?: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  keyId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: Buffer;
  publicEncryptionIv?: Buffer;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: Buffer;
  publicEncryptionTag?: Buffer;
  version?: string;
};

/**
 * Stricter type for parser return values where all parsed fields are guaranteed
 * non-optional. Parsers (tokenised, encoded, serialised) always produce complete
 * records; this type reflects that guarantee at the type level.
 */
export type ParsedAesDecryptionRecord = {
  algorithm: KryptosAlgorithm;
  authTag: Buffer;
  content: Buffer;
  contentType: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: Buffer;
  keyId: string;
  pbkdfIterations: number | undefined;
  pbkdfSalt: Buffer | undefined;
  publicEncryptionIv: Buffer | undefined;
  publicEncryptionJwk: PublicEncryptionJwk | undefined;
  publicEncryptionKey: Buffer | undefined;
  publicEncryptionTag: Buffer | undefined;
  version: string;
};

export type SerialisedAesDecryption = {
  algorithm?: KryptosAlgorithm;
  authTag?: string;
  content: string;
  contentType?: AesContentType;
  encryption: KryptosEncryption;
  initialisationVector: string;
  keyId?: string;
  pbkdfIterations?: number;
  pbkdfSalt?: string;
  publicEncryptionIv?: string;
  publicEncryptionJwk?: PublicEncryptionJwk;
  publicEncryptionKey?: string;
  publicEncryptionTag?: string;
  version?: string;
};
