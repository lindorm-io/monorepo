import { KryptosUse } from "./types";

export type OctEncAlgorithm = "dir" | "A128KW" | "A192KW" | "A256KW";

export type OctSigAlgorithm = "HS256" | "HS384" | "HS512";

export type OctAlgorithm = OctEncAlgorithm | OctSigAlgorithm;

export type OctSize = 64 | 96 | 128;

export type OctGenerateEnc = {
  algorithm: OctEncAlgorithm;
  type: "oct";
  use: "enc";
};

export type OctGenerateSig = {
  algorithm: OctSigAlgorithm;
  type: "oct";
  use: "sig";
};

export type OctGenerate = OctGenerateEnc | OctGenerateSig;

export type OctB64 = {
  algorithm: OctAlgorithm;
  privateKey: string;
  publicKey: string; // empty
  type: "oct";
  use: KryptosUse;
};

export type OctDer = {
  algorithm: OctAlgorithm;
  privateKey: Buffer;
  publicKey: Buffer; // empty
  type: "oct";
  use: KryptosUse;
};

export type OctJwk = {
  alg: OctAlgorithm;
  k: string;
  kty: "oct";
  use: KryptosUse;
};

export type OctPem = {
  algorithm: OctAlgorithm;
  privateKey: string;
  publicKey: string; // empty
  type: "oct";
  use: KryptosUse;
};
