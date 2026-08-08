// The OAuth 2.0 claim family — the claims defined by an OAuth spec rather than by
// RFC 7519 (StdClaims), OIDC Core (OidcClaims/AegisProfile) or lindorm itself.
//
// - `entitlements` / `groups` / `roles` — RFC 9068 §2.2.3.1, JWT Profile for
//   OAuth 2.0 Access Tokens.
//   https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1
// - `username` — RFC 7662 §2.2, OAuth 2.0 Token Introspection. It is a CLAIM, not
//   merely a response member: an authorization server that can report a human-
//   readable identifier for the token's resource owner means a token can carry
//   one, so it registers here and reaches the domain layer from BOTH a token
//   payload and an introspection answer.
//   https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
//
// ⚠ `username` is NOT OIDC Core §5.1 `preferred_username` — that is a separate,
// separately registered PROFILE claim on `AegisProfile`. Neither shadows the
// other; a token may carry both, and they round-trip independently.
export type OAuthClaims = {
  entitlements?: Array<string>;
  groups?: Array<string>;
  roles?: Array<string>;
  username?: string;
};
