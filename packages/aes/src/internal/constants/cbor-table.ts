import type { KryptosAlgorithm, KryptosEncryption } from "@lindorm/kryptos";
import type { AesContentType } from "../../types/content.js";

// The AES CBOR wire vocabulary — a proprietary, compact translation table for the
// `aes:`-prefixed CBOR string format. NOT COSE: COSE's registry cannot express the
// full kryptos algorithm matrix (no CBC-HS composites, no GCMKW, no PBES2, no
// RSA-OAEP-384), so this table stands on its own. The integer assignments mirror
// the kryptos env table (packages/kryptos/src/internal/constants/cbor-table.ts) so
// a human reading either raw decode sees the same vocabulary.
//
// Conventions:
// - Map keys are ALWAYS unsigned integers (the labels below). Label 0 is the
//   format version.
// - `algorithm` / `encryption` / `contentType` are enumerable → integer codes;
//   the IV / tag / ciphertext / wrapped-CEK / salt / public-encryption IV+tag are
//   byte strings (raw bytes, no base64 text); `keyId` is free-form text; the
//   PBKDF2 iteration count is a plain integer; the ephemeral public key (`epk`)
//   is a self-describing sub-map (bespoke).
// - Once a format version ships, existing assignments are FROZEN — extend, never
//   renumber.

export const AES_CBOR_VERSION = 1;

// --- Map labels (integer keys of the encoded map) ---------------------------

export const AES_CBOR_LABEL = {
  version: 0,
  keyId: 2,
  algorithm: 3,
  encryption: 6,
  contentType: 7,
  initialisationVector: 8,
  authTag: 9,
  content: 10,
  publicEncryptionKey: 11,
  pbkdfIterations: 12,
  pbkdfSalt: 13,
  publicEncryptionIv: 14,
  publicEncryptionTag: 15,
  publicEncryptionJwk: 16,
} as const;

// --- Value enums -------------------------------------------------------------

export const AES_CBOR_CTY = {
  "application/json": 1,
  "application/octet-stream": 2,
  "text/plain": 3,
} as const satisfies Record<AesContentType, number>;

// Signature families in 10-50, key-management families in 60-90 — the same
// numbering as the kryptos env table. `algorithm` on an AES record is always a
// key-management algorithm, but the field type is the full `KryptosAlgorithm`
// union, so every member carries a code (adding an algorithm without extending
// this table is a compile error).
export const AES_CBOR_ALG = {
  // 10s — EC signatures
  ES256: 10,
  ES384: 11,
  ES512: 12,
  // 20s — OKP signatures
  EdDSA: 20,
  // 30s — RSA signatures
  RS256: 30,
  RS384: 31,
  RS512: 32,
  PS256: 33,
  PS384: 34,
  PS512: 35,
  // 40s — oct signatures
  HS256: 40,
  HS384: 41,
  HS512: 42,
  // 50s — AKP (post-quantum) signatures
  "ML-DSA-44": 50,
  "ML-DSA-65": 51,
  "ML-DSA-87": 52,
  // 60s — ECDH key agreement (EC + OKP)
  "ECDH-ES": 60,
  "ECDH-ES+A128KW": 61,
  "ECDH-ES+A192KW": 62,
  "ECDH-ES+A256KW": 63,
  "ECDH-ES+A128GCMKW": 64,
  "ECDH-ES+A192GCMKW": 65,
  "ECDH-ES+A256GCMKW": 66,
  // 70s — RSA key encryption
  "RSA-OAEP": 70,
  "RSA-OAEP-256": 71,
  "RSA-OAEP-384": 72,
  "RSA-OAEP-512": 73,
  // 80s — oct direct/wrap
  dir: 80,
  A128KW: 81,
  A192KW: 82,
  A256KW: 83,
  A128GCMKW: 84,
  A192GCMKW: 85,
  A256GCMKW: 86,
  // 90s — PBES2
  "PBES2-HS256+A128KW": 90,
  "PBES2-HS384+A192KW": 91,
  "PBES2-HS512+A256KW": 92,
} as const satisfies Record<KryptosAlgorithm, number>;

// Content encryption: CBC-HS composites 1-3, GCM 10-12, CCM 20-27.
export const AES_CBOR_ENC = {
  "A128CBC-HS256": 1,
  "A192CBC-HS384": 2,
  "A256CBC-HS512": 3,
  A128GCM: 10,
  A192GCM: 11,
  A256GCM: 12,
  "AES-CCM-16-64-128": 20,
  "AES-CCM-16-64-256": 21,
  "AES-CCM-64-64-128": 22,
  "AES-CCM-64-64-256": 23,
  "AES-CCM-16-128-128": 24,
  "AES-CCM-16-128-256": 25,
  "AES-CCM-64-128-128": 26,
  "AES-CCM-64-128-256": 27,
} as const satisfies Record<KryptosEncryption, number>;
