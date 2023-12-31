export type EcAlgorithm = "ES256" | "ES384" | "ES512";

export type OctAlgorithm = "HS256" | "HS384" | "HS512";

export type OkpAlgorithm = "EdDSA" | "ECDH-ES";

export type RsaAlgorithm = "RS256" | "RS384" | "RS512";

export type KeySetAlgorithm = EcAlgorithm | OctAlgorithm | OkpAlgorithm | RsaAlgorithm;
