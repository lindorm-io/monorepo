export type EcdhJwk = {
  // common
  x: string;
  y: string;
  crv: string;

  // specific for private keys
  d?: string;
};

export type RsaJwk = {
  // common
  e: string;
  n: string;

  // specific for private keys
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;
};

export type SpecificJwk = EcdhJwk | RsaJwk;

export type StandardJwk = {
  alg: "ES256" | "ES384" | "ES512" | "RS256" | "RS384" | "RS512";
  key_ops: Array<string>;
  kid: string;
  kty: "EC" | "RSA";
  use: "enc" | "sig";
};

export type JWK = StandardJwk & SpecificJwk;
