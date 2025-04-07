import { KryptosUse } from "../types";

export type OkpEncAlgorithm =
  | "ECDH-ES"
  | "ECDH-ES+A128KW"
  | "ECDH-ES+A192KW"
  | "ECDH-ES+A256KW"
  | "ECDH-ES+A128GCMKW"
  | "ECDH-ES+A192GCMKW"
  | "ECDH-ES+A256GCMKW";

export type OkpSigAlgorithm = "EdDSA";

export type OkpAlgorithm = OkpEncAlgorithm | OkpSigAlgorithm;

export type OkpEncCurve = "X25519" | "X448";

export type OkpSigCurve = "Ed25519" | "Ed448";

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
