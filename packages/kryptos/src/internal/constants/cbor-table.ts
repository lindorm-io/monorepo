import type { AesEncryption } from "@lindorm/types";
import type {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosType,
  KryptosUse,
  LindormJwk,
} from "../../types/index.js";

// Kryptos CBOR translation table — the proprietary, kryptos-own wire vocabulary
// for the compact env-string format. NOT COSE: COSE's registry cannot express
// the full kryptos algorithm matrix (no CBC-HS composites, no GCMKW, no PBES2,
// no RSA-OAEP-384), so this table stands on its own. The only deliberate COSE
// coincidences are the first three map labels (kty=1, kid=2, alg=3).
//
// Conventions:
// - Map keys are ALWAYS unsigned integers (the labels below).
// - Values are integers wherever the domain is enumerable (kty, use, crv, alg,
//   enc), CBOR-native scalars where possible (hidden: bool; exp/iat/nbf:
//   unix-seconds ints), byte strings for all key material and DER certs
//   (raw bytes — never base64 text), and text strings ONLY for free-form
//   fields (kid, iss, jku, purpose, owner_id).
// - Label 0 is the format version so the vocabulary can evolve without
//   breaking strings already vaulted in password managers.
// - DERIVABLES ARE NEVER ENCODED, and therefore carry no label at all:
//   `x5t#S256` (recompute from x5c) and `key_ops` (`operations` is derived from
//   the key material — see `calculateKeyOps`). Both are excluded from
//   `CborLabelDomain` below, so sneaking one back into the encoder is a compile
//   error.
// - Enum values are grouped in decades by family so a raw decode is
//   half-readable to a human who knows the table.
//
// Every enum is `satisfies`-checked against the kryptos union types: adding an
// algorithm/curve/operation to the library without extending this table is a
// compile error. Values must stay unique and, once a format version ships,
// existing assignments are FROZEN — extend, never renumber.

export const CBOR_VERSION = 1;

// --- Map labels (integer keys of the encoded map) ---------------------------

// The label set must cover every member of LindormJwk (the full private-JWK
// surface) except the deliberately-omitted DERIVABLES — `x5t#S256` (recompute
// from x5c) and `key_ops` (derived from the key material, never emitted) — plus
// the format-internal `version`. Adding a JWK member without a label is a
// compile error; sneaking a derivable back in is too (excess property).
type CborLabelDomain = Record<
  Exclude<keyof LindormJwk, "x5t#S256" | "key_ops">,
  number
> & {
  version: number;
};

export const CBOR_LABEL = {
  version: 0,
  kty: 1, // COSE-coincident
  kid: 2, // COSE-coincident (tstr here, bstr in COSE)
  alg: 3, // COSE-coincident
  use: 4,
  crv: 5,
  enc: 6,
  exp: 10,
  iat: 11,
  nbf: 12,
  iss: 13,
  jku: 14,
  purpose: 15,
  hidden: 16,
  owner_id: 17,
  x5c: 20, // array of bstr (raw DER, leaf first)
  // key material (bstr, raw bytes)
  x: 30,
  y: 31,
  d: 32,
  n: 33,
  e: 34,
  p: 35,
  q: 36,
  dp: 37,
  dq: 38,
  qi: 39,
  k: 40,
  pub: 41,
  priv: 42,
} as const satisfies CborLabelDomain;

// --- Value enums -------------------------------------------------------------

export const CBOR_KTY = {
  EC: 1,
  OKP: 2,
  RSA: 3,
  oct: 4,
  AKP: 5,
} as const satisfies Record<KryptosType, number>;

export const CBOR_USE = {
  sig: 1,
  enc: 2,
} as const satisfies Record<KryptosUse, number>;

export const CBOR_CRV = {
  "P-256": 1,
  "P-384": 2,
  "P-521": 3,
  Ed25519: 4,
  Ed448: 5,
  X25519: 6,
  X448: 7,
} as const satisfies Record<KryptosCurve, number>;

// Signature families in 10-50, key-management families in 60-90.
export const CBOR_ALG = {
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
export const CBOR_ENC = {
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
} as const satisfies Record<AesEncryption, number>;
