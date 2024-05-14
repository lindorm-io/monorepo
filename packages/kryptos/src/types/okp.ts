export type OkpSigAlgorithm = "EdDSA";

export type OkpAlgorithm = OkpSigAlgorithm;

export type OkpCurve = "Ed25519" | "Ed448" | "X25519" | "X448";

export type OkpKeyJwk = {
  d?: string;
  x: string;
  crv: OkpCurve;
  kty: "OKP";
};
