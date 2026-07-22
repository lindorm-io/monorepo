// RFC 7519 §4.1 — domain (camelCase) form of the registered claims.
export type StdClaims = {
  audience?: Array<string>;
  expiresAt?: Date;
  issuedAt?: Date;
  issuer?: string;
  notBefore?: Date;
  subject?: string;
  tokenId?: string;
};
