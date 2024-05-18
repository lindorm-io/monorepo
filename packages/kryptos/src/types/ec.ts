import { KryptosUse } from "./types";

export type EcSigAlgorithm = "ES256" | "ES384" | "ES512";

export type EcEncAlgorithm =
  | "ECDH-ES"
  | "ECDH-ES+A128KW"
  | "ECDH-ES+A192KW"
  | "ECDH-ES+A256KW";

export type EcAlgorithm = EcEncAlgorithm | EcSigAlgorithm;

export type EcCurve = "P-256" | "P-384" | "P-521";

export type EcGenerateEnc = {
  algorithm: EcEncAlgorithm;
  curve?: EcCurve;
  type: "EC";
  use: "enc";
};

export type EcGenerateSig = {
  algorithm: EcSigAlgorithm;
  curve?: EcCurve;
  type: "EC";
  use: "sig";
};

export type EcGenerate = EcGenerateEnc | EcGenerateSig;

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
