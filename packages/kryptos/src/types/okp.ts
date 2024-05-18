import { KryptosUse } from "./types";

export type OkpEncAlgorithm = "ECDH-ES";

export type OkpSigAlgorithm = "EdDSA";

export type OkpAlgorithm = OkpEncAlgorithm | OkpSigAlgorithm;

export type OkpEncCurve = "X25519" | "X448";

export type OkpSigCurve = "Ed25519" | "Ed448";

export type OkpCurve = OkpEncCurve | OkpSigCurve;

export type OkpGenerateEnc = {
  algorithm: OkpEncAlgorithm;
  curve: OkpEncCurve;
  type: "OKP";
  use: "enc";
};

export type OkpGenerateSig = {
  algorithm: OkpSigAlgorithm;
  curve: OkpSigCurve;
  type: "OKP";
  use: "sig";
};

export type OkpGenerate = OkpGenerateEnc | OkpGenerateSig;

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
