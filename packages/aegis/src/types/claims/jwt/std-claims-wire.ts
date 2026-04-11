// https://datatracker.ietf.org/doc/html/rfc7519#section-4.1
export type StdClaimsWire = {
  aud?: Array<string>; // audience
  exp?: number; // expires at
  iat?: number; // issued at
  iss?: string; // issuer
  jti?: string; // id
  nbf?: number; // not usable before
  sub?: string; // subject
};
