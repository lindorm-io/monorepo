export type EllipticCurve = "P-256" | "P-384" | "P-521";

export type EcJwkAlgorithm = "ES256" | "ES384" | "ES512";

export type OctJwkAlgorithm = "HS256" | "HS384" | "HS512";

export type RsaJwkAlgorithm = "RS256" | "RS384" | "RS512";

export type JwkAlgorithm = EcJwkAlgorithm | OctJwkAlgorithm | RsaJwkAlgorithm;

export type JwkOps =
  | "decrypt"
  | "deriveBits"
  | "deriveKey"
  | "encrypt"
  | "sign"
  | "unwrapKey"
  | "verify"
  | "wrapKey";

export type JwkUse = "enc" | "sig";

export type JwkType = "EC" | "RSA" | "oct";
