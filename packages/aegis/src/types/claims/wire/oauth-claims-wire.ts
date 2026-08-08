// Wire form of OAuthClaims — the OAuth 2.0 claim family.
//
// `groups`, `entitlements`, and `roles` are the standard authorization claims for
// an access token (RFC 9068 §2.2.3.1). `username` is the RFC 7662 §2.2 human-
// readable identifier for the token's resource owner — a claim about the token,
// NOT the OIDC Core §5.1 `preferred_username` profile field (that lives on
// `AegisProfileWire`, and the two never shadow each other).
//
// https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1
// https://datatracker.ietf.org/doc/html/rfc7662#section-2.2
export type OAuthClaimsWire = {
  entitlements?: Array<string>;
  groups?: Array<string>;
  roles?: Array<string> | string;
  username?: string;
};
