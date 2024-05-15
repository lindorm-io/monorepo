import { KryptosUse } from "./types";

export type OkpSigAlgorithm = "EdDSA" | "ECDH";

export type OkpAlgorithm = OkpSigAlgorithm;

export type OkpCurve = "Ed25519" | "Ed448" | "X25519" | "X448";

export type OkpGenerate = {
  curve: OkpCurve;
  type: "OKP";
};

export type OkpB64 = {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  privateKey?: string;
  publicKey: string;
  type: "OKP";
  use: KryptosUse;
};

export type OkpDer = {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "OKP";
  use: KryptosUse;
};

export type OkpJwk = {
  alg: OkpAlgorithm;
  d?: string;
  x: string;
  crv: OkpCurve;
  kty: "OKP";
  use: KryptosUse;
};

export type OkpPem = {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  privateKey?: string;
  publicKey: string;
  type: "OKP";
  use: KryptosUse;
};
