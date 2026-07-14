/**
 * The ECDH-ES family, shared verbatim by EC and OKP keys — both key types
 * support every one of these. It lives here, once, so the flat
 * `KRYPTOS_ENC_ALGORITHMS` can compose from it WITHOUT listing the family
 * twice (a consumer iterating that list would otherwise see each ECDH-ES
 * algorithm duplicated — e.g. an OIDC discovery document advertising
 * `ECDH-ES` twice in `id_token_encryption_alg_values_supported`).
 *
 * NB `ECDH-ES+A*GCMKW` are NOT registered JWE algorithms — RFC 7518 §4.6
 * defines only `ECDH-ES` and the three `+A*KW` variants. They are a
 * deliberate on-platform choice and `jose` rejects them outright, which
 * `Kryptos.jose-interop.test.ts` asserts as intentional.
 */
export const ECDH_ES_ALGORITHMS = [
  "ECDH-ES",
  "ECDH-ES+A128KW",
  "ECDH-ES+A192KW",
  "ECDH-ES+A256KW",
  "ECDH-ES+A128GCMKW",
  "ECDH-ES+A192GCMKW",
  "ECDH-ES+A256GCMKW",
] as const;

export type EcdhEsAlgorithm = (typeof ECDH_ES_ALGORITHMS)[number];
