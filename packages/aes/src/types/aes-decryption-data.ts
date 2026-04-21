import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContent, AesContentType } from "./content.js";
import type { PublicEncryptionJwk } from "./types.js";

export type AesEncryptionMode = "encoded" | "record" | "serialised" | "tokenised";

export type AesEncryptionOptions = {
  aad?: Buffer;
  data: AesContent;
  encryption?: KryptosEncryption;
};

export type AesDecryptionRecord = {
  aad?: Buffer;
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

/**
 * Stricter variant returned by the string/serialised parsers. These parsers
 * always derive `aad` from the header, so it is guaranteed non-optional.
 * Record-mode inputs (where `aad` is supplied via options) continue to use
 * the looser `AesDecryptionRecord`.
 */
export type ParsedAesDecryptionRecord = AesDecryptionRecord & { aad: Buffer };

export type SerialisedAesDecryption = {
  cek?: string;
  ciphertext: string;
  header: string;
  iv: string;
  tag: string;
  v: string;
};
