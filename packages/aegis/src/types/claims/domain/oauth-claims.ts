// RFC 9068 — JWT Profile for OAuth 2.0 Access Tokens.
// `roles`, `groups`, and `entitlements` claims as standardized by §2.2.3.1.
//
// https://datatracker.ietf.org/doc/html/rfc9068#section-2.2.3.1
export type OAuthClaims = {
  entitlements?: Array<string>;
  groups?: Array<string>;
  roles?: Array<string>;
};
