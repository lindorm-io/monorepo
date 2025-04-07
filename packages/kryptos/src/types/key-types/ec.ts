import { KryptosUse } from "../types";

export type EcEncAlgorithm =
  | "ECDH-ES"
  | "ECDH-ES+A128KW"
  | "ECDH-ES+A192KW"
  | "ECDH-ES+A256KW"
  | "ECDH-ES+A128GCMKW"
  | "ECDH-ES+A192GCMKW"
  | "ECDH-ES+A256GCMKW";

export type EcSigAlgorithm = "ES256" | "ES384" | "ES512";

export type EcAlgorithm = EcEncAlgorithm | EcSigAlgorithm;

export type EcCurve = "P-256" | "P-384" | "P-521";

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
