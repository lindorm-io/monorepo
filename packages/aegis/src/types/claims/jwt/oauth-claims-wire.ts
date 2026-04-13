// Wire form of OAuthClaims — RFC 9068 (JWT Profile for OAuth 2.0 Access
// Tokens). `groups`, `entitlements`, and `roles` are the standard
// authorization claims for an access token.
//
// https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1
export type OAuthClaimsWire = {
  entitlements?: Array<string>;
  groups?: Array<string>;
  roles?: Array<string> | string;
};
