import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContent, AesContentType } from "./content.js";
import type { PublicEncryptionJwk } from "./types.js";

export type AesEncryptionMode = "cbor" | "record" | "serialised";

export type AesEncryptionOptions = {
  aad?: Buffer;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Optional; consumed
  // only by the ECDH-ES key-agreement paths, and emitted on the header so the
  // recipient re-derives the identical content encryption key.
  apu?: Buffer;
  apv?: Buffer;
  data: AesContent;
  encryption?: KryptosEncryption;
};

export type AesDecryptionRecord = {
  aad?: Buffer;
  // RFC 7518 §4.6 — ECDH-ES Concat-KDF OtherInfo (apu/apv). Optional: only the
  // ECDH-ES key-management algorithms carry them, and the record may be built
  // from a wire header (e.g. a JWE) that supplied them.
  apu?: Buffer;
  apv?: Buffer;
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
