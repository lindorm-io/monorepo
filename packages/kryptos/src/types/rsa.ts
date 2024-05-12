export type RsaAlgorithm = "RS256" | "RS384" | "RS512";

export type RsaModulus = 1 | 2 | 3 | 4;

export type RsaKeyJwk = {
  e: string;
  n: string;
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;
  kty: "RSA";
};
