export type EllipticCurve = "P-256" | "P-384" | "P-521";

export type EcJwkAlgorithm = "ES256" | "ES384" | "ES512";

export type RsaJwkAlgorithm = "RS256" | "RS384" | "RS512";

export type JwkAlgorithm = EcJwkAlgorithm | RsaJwkAlgorithm;

export type JwkUse = "enc" | "sig";

export type JwkType = "EC" | "RSA";
