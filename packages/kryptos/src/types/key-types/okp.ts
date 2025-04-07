import { KryptosUse } from "../types";

export const OKP_ENC_ALGORITHMS = [
  "ECDH-ES",
  "ECDH-ES+A128KW",
  "ECDH-ES+A192KW",
  "ECDH-ES+A256KW",
  "ECDH-ES+A128GCMKW",
  "ECDH-ES+A192GCMKW",
  "ECDH-ES+A256GCMKW",
] as const;

export const OKP_SIG_ALGORITHMS = ["EdDSA"] as const;

export const OKP_ENC_CURVES = ["X25519", "X448"] as const;

export const OKP_SIG_CURVES = ["Ed25519", "Ed448"] as const;

export type OkpEncAlgorithm = (typeof OKP_ENC_ALGORITHMS)[number];

export type OkpSigAlgorithm = (typeof OKP_SIG_ALGORITHMS)[number];

export type OkpAlgorithm = OkpEncAlgorithm | OkpSigAlgorithm;

export type OkpEncCurve = (typeof OKP_ENC_CURVES)[number];

export type OkpSigCurve = (typeof OKP_SIG_CURVES)[number];

export type OkpCurve = OkpEncCurve | OkpSigCurve;

export type OkpString = {
  id: string;
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  privateKey?: string;
  publicKey: string;
  type: "OKP";
  use: KryptosUse;
};

export type OkpBuffer = {
  id: string;
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "OKP";
  use: KryptosUse;
};

export type OkpJwk = {
  kid: string;
  alg: OkpAlgorithm;
  d?: string;
  x: string;
  crv: OkpCurve;
  kty: "OKP";
  use: KryptosUse;
};
