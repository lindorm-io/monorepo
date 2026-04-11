// OpenID Connect Core 1.0 §2 — ID Token claims, domain form.
export type OidcClaims = {
  accessTokenHash?: string;
  authContextClass?: string;
  authMethods?: Array<string>;
  authorizedParty?: string;
  authTime?: Date;
  codeHash?: string;
  nonce?: string;
  stateHash?: string;
};
