// OIDC Core §9 (defines the first four) + RFC 7591 §2 (private_key_jwt,
// tls_client_auth, self_signed_tls_client_auth, none) + RFC 8705 (mTLS).
export type OpenIdTokenAuthMethod =
  | "client_secret_basic"
  | "client_secret_jwt"
  | "client_secret_post"
  | "private_key_jwt"
  | "self_signed_tls_client_auth"
  | "tls_client_auth"
  | "none"
  | (string & {});
