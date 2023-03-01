export type StandardJwtClaims = {
  aud: Array<string>; // audience
  exp: number; // expires at
  iat: number; // issued at
  iss: string; // issuer
  jti: string; // id
  nbf: number; // not before
  sub: string; // subject
};
