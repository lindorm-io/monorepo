import type { AuthMethod } from "@lindorm/openid";

// OpenID Connect Core 1.0 §2 — ID Token claims, domain form.
export type OidcClaims = {
  accessTokenHash?: string;
  authContextClassReference?: string;
  // Whatever AMR values the issuer put in the token — aegis parses tokens it
  // did not mint, and RFC 8176 §1 anticipates values beyond the registry. The
  // openid `AuthMethod` set is CLOSED on purpose, so the extender widens here;
  // the wire form (`amr?: Array<string>`) says the same thing.
  authMethods?: Array<AuthMethod | (string & {})>;
  authorizedParty?: string;
  authTime?: Date;
  codeHash?: string;
  nonce?: string;
  stateHash?: string;
  vectorOfTrust?: string;
  vectorTrustMark?: string;
};
