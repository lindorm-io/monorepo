import { isUrn } from "@lindorm/is";

/**
 * The service's OWN JWKS location, derived from its `internal.issuer` — the one
 * place that derivation happens (the `amphora.internal` accessor and the
 * `jwksUri` stamped on every key we add both read it here).
 *
 * A URN is a legal issuer but has no authority to reach, and `new URL(path,
 * "urn:…")` throws rather than producing anything — so there is nothing to
 * derive and the answer is `null`, not a guess. That mirrors the external side,
 * where a URN issuer must be handed an explicit `jwksUri`
 * (`urn_issuer_requires_jwks_uri`) for exactly the same reason.
 */
export const deriveInternalJwksUri = (issuer: string): string | null =>
  isUrn(issuer) ? null : new URL("/.well-known/jwks.json", issuer).toString();
