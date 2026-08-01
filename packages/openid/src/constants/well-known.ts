/**
 * The well-known URI paths this vocabulary covers. Paths are relative to the
 * issuer origin — resolve them with `new URL(path, issuer)` at the point of
 * use (this package never fetches anything itself).
 */

/** OIDC Discovery 1.0 §4 — the OpenID Provider configuration document. */
export const WELL_KNOWN_OPENID_CONFIGURATION = "/.well-known/openid-configuration";

/** RFC 8414 §3 — the OAuth 2.0 authorization server metadata document. */
export const WELL_KNOWN_OAUTH_AUTHORIZATION_SERVER =
  "/.well-known/oauth-authorization-server";

/** RFC 9728 §3 — the OAuth 2.0 protected resource metadata document. */
export const WELL_KNOWN_OAUTH_PROTECTED_RESOURCE =
  "/.well-known/oauth-protected-resource";

/**
 * The conventional JWKS path. NOT specified — the authoritative location is
 * always the `jwks_uri` from the discovery document; this is only a fallback
 * for issuers that publish no discovery document.
 */
export const WELL_KNOWN_JWKS = "/.well-known/jwks.json";
