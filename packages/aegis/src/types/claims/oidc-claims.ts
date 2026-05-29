import type { AuthMethod } from "./auth-method.js";

// OpenID Connect Core 1.0 §2 — ID Token claims, domain form.
export type OidcClaims = {
  accessTokenHash?: string;
  authContextClass?: string;
  authMethods?: Array<AuthMethod>;
  authorizedParty?: string;
  authTime?: Date;
  codeHash?: string;
  nonce?: string;
  stateHash?: string;
};
