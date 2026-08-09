import { isHttpUrl } from "@lindorm/is";

/**
 * The service's OWN JWKS location, derived from its `internal.issuer` — the one
 * place that derivation happens (the `amphora.internal` accessor and the
 * `jwksUri` stamped on every key we add both read it here).
 *
 * Deriving a location needs an issuer that IS one: an http(s) URL. A URN has no
 * authority to reach and `new URL(path, "urn:…")` throws outright, and any other
 * scheme with a host (`ftp://…`) resolves to a syntactically valid address
 * nothing can fetch — a worse answer than none. Both are legal issuers, so the
 * answer is `null` rather than a guess, and keys registered under one carry no
 * published location. That mirrors the external side, where such an issuer must
 * be handed an explicit `jwksUri` (`non_http_issuer_requires_jwks_uri`) for
 * exactly the same reason.
 */
export const deriveInternalJwksUri = (issuer: string): string | null =>
  isHttpUrl(issuer) ? new URL("/.well-known/jwks.json", issuer).toString() : null;
