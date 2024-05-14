export type EcSigAlgorithm = "ES256" | "ES384" | "ES512";

export type EcEncAlgorithm = "ECDH-ES";

export type EcAlgorithm = EcEncAlgorithm | EcSigAlgorithm;

export type EcCurve = "P-256" | "P-384" | "P-521";

export type EcKeyJwk = {
  d?: string;
  x: string;
  y: string;
  crv: EcCurve;
  kty: "EC";
};
