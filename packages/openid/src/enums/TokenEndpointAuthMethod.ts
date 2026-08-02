/**
 * Client authentication methods at the token endpoint.
 *
 * OIDC Core §9 defines the first four; RFC 7591 §2 adds `none`; RFC 8705 §2
 * adds the mTLS methods.
 *
 * The type is CLOSED — exactly the methods listed here. The "OAuth Token
 * Endpoint Authentication Methods" IANA registry is extensible, but a
 * deployment accepting an unlisted method widens in its OWN package.
 */
export const TokenEndpointAuthMethod = {
  /** wire: `client_secret_basic` — OIDC Core §9; the spec DEFAULT when unspecified */
  ClientSecretBasic: "client_secret_basic",
  /** wire: `client_secret_jwt` — OIDC Core §9 */
  ClientSecretJwt: "client_secret_jwt",
  /** wire: `client_secret_post` — OIDC Core §9 */
  ClientSecretPost: "client_secret_post",
  /** wire: `private_key_jwt` — OIDC Core §9 */
  PrivateKeyJwt: "private_key_jwt",
  /** wire: `self_signed_tls_client_auth` — RFC 8705 §2.2 */
  SelfSignedTlsClientAuth: "self_signed_tls_client_auth",
  /** wire: `tls_client_auth` — RFC 8705 §2.1 */
  TlsClientAuth: "tls_client_auth",
  /** wire: `none` — RFC 7591 §2; public clients */
  None: "none",
} as const;

export type TokenEndpointAuthMethod =
  (typeof TokenEndpointAuthMethod)[keyof typeof TokenEndpointAuthMethod];
