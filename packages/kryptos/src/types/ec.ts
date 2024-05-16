import { KryptosUse } from "./types";

export type EcSigAlgorithm = "ES256" | "ES384" | "ES512";

export type EcEncAlgorithm = "ECDH-ES";

export type EcAlgorithm = EcEncAlgorithm | EcSigAlgorithm;

export type EcCurve = "P-256" | "P-384" | "P-521";

export type EcGenerate = {
  curve: EcCurve;
  type: "EC";
};

export type EcB64 = {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
  use: KryptosUse;
};

export type EcDer = {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "EC";
  use: KryptosUse;
};

export type EcJwk = {
  alg: EcAlgorithm;
  d?: string;
  x: string;
  y: string;
  crv: EcCurve;
  kty: "EC";
  use: KryptosUse;
};

export type EcPem = {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
  use: KryptosUse;
};
