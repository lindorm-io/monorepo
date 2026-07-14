import type { KryptosUse } from "../types.js";
import { ECDH_ES_ALGORITHMS } from "./ecdh.js";

export const EC_ENC_ALGORITHMS = ECDH_ES_ALGORITHMS;

export const EC_SIG_ALGORITHMS = ["ES256", "ES384", "ES512"] as const;

export const EC_CURVES = ["P-256", "P-384", "P-521"] as const;

export type EcEncAlgorithm = (typeof EC_ENC_ALGORITHMS)[number];

export type EcSigAlgorithm = (typeof EC_SIG_ALGORITHMS)[number];

export type EcAlgorithm = EcEncAlgorithm | EcSigAlgorithm;

export type EcCurve = (typeof EC_CURVES)[number];

export type EcString = {
  id: string;
  algorithm: EcAlgorithm;
  curve: EcCurve;
  privateKey?: string;
  publicKey: string;
  type: "EC";
  use: KryptosUse;
};

export type EcBuffer = {
  id: string;
  algorithm: EcAlgorithm;
  curve: EcCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "EC";
  use: KryptosUse;
};

export type EcJwk = {
  kid: string;
  alg: EcAlgorithm;
  d?: string;
  x: string;
  y: string;
  crv: EcCurve;
  kty: "EC";
  use: KryptosUse;
};
