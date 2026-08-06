/**
 * The resolved provider surface — the SINGLE source of provider truth a driver
 * publishes. Discovery-backed drivers derive it from the discovery document; a
 * driver for a provider that publishes no `.well-known/openid-configuration`
 * (GitHub, Discord) returns a literal.
 *
 * `issuer` and `jwksUri` belong here rather than on static configuration
 * because pylon verifies id_tokens against THEM: Microsoft's discovery document
 * may template the issuer as `{tenantid}` while the real issuer is
 * tenant-specific, so only the driver can resolve the concrete value.
 *
 * Every OPTIONAL endpoint is `string | null`. `null` is the driver STATING that
 * the provider has none — a fact pylon can act on (no `end_session_endpoint`
 * means a local logout, not a failure).
 */
export type PylonAuthEndpoints = {
  /** wire: `issuer` — REQUIRED. What issued tokens must carry as `iss`. */
  issuer: string;

  /** wire: `jwks_uri` — `null` for a provider whose tokens are not JWTs. */
  jwksUri: string | null;

  /** wire: `authorization_endpoint` — RFC 6749 §3.1. */
  authorizationEndpoint: string;

  /** wire: `token_endpoint` — RFC 6749 §3.2. */
  tokenEndpoint: string;

  /** wire: `userinfo_endpoint` — OIDC Core §5.3. */
  userinfoEndpoint: string | null;

  /** wire: `introspection_endpoint` — RFC 7662 §2. */
  introspectionEndpoint: string | null;

  /** wire: `revocation_endpoint` — RFC 7009 §2. */
  revocationEndpoint: string | null;

  /** wire: `end_session_endpoint` — OIDC RP-Initiated Logout 1.0 §2. */
  endSessionEndpoint: string | null;
};
