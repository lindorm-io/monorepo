export type RsaSigAlgorithm = "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512";

export type RsaEncAlgorithm =
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512"
  | "RSA-PRIVATE-KEY";

export type RsaAlgorithm = RsaEncAlgorithm | RsaSigAlgorithm;

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
