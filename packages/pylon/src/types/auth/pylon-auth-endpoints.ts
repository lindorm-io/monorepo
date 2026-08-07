/**
 * The resolved provider surface — the SINGLE source of provider truth a driver
 * publishes. Discovery-backed drivers project it off the document amphora
 * already holds; a driver for a provider that publishes no
 * `.well-known/openid-configuration` (GitHub, Discord) returns a literal.
 *
 * ⚠ There is NO `jwks_uri` here, deliberately. Amphora owns key material — it
 * fetches, caches and rotates every issuer's JWKS, and pylon verifies against
 * the vault, never against a URI a driver hands back. A member that looks like
 * it configures verification but is read by nothing is worse than no member.
 *
 * ⚠ `issuer` is the ONLY member guaranteed non-null: without it there is no
 * relationship to name. Every endpoint — `authorization_endpoint` and
 * `token_endpoint` included — is `string | null`, because a VERIFY-ONLY driver
 * (see `JwtDriver`) pins an issuer and has no OAuth endpoints at all. `null` is
 * the driver STATING that the provider has none — a fact pylon can act on (no
 * `end_session_endpoint` means a local logout, not a failure).
 */
export type PylonAuthEndpoints = {
  /** wire: `issuer` — REQUIRED. What issued tokens must carry as `iss`. */
  issuer: string;

  /**
   * wire: `authorization_endpoint` — RFC 6749 §3.1. `null` for a driver that
   * starts no authorization request (a verify-only driver, a resource server
   * against a provider that publishes none).
   */
  authorizationEndpoint: string | null;

  /** wire: `token_endpoint` — RFC 6749 §3.2. `null` for a driver that runs no grant. */
  tokenEndpoint: string | null;

  /** wire: `userinfo_endpoint` — OIDC Core §5.3. */
  userinfoEndpoint: string | null;

  /** wire: `introspection_endpoint` — RFC 7662 §2. */
  introspectionEndpoint: string | null;

  /** wire: `revocation_endpoint` — RFC 7009 §2. */
  revocationEndpoint: string | null;

  /** wire: `end_session_endpoint` — OIDC RP-Initiated Logout 1.0 §2. */
  endSessionEndpoint: string | null;
};
