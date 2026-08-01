import type { Jwks } from "@lindorm/types";

/**
 * RFC 7517 §5 — a JWK Set, as served from the discovery document's `jwks_uri`.
 */
export type JwksResponse = {
  /** wire: `keys` — REQUIRED (RFC 7517 §5.1) */
  keys: Array<Jwks>;
};
