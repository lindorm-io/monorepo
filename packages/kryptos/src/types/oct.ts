import { KryptosUse } from "./types";

export type OctSigAlgorithm = "HS256" | "HS384" | "HS512";

export type OctEncAlgorithm = "dir" | "A128KW" | "A192KW" | "A256KW";

export type OctAlgorithm = OctSigAlgorithm | OctEncAlgorithm;

export type OctSize = 64 | 128 | 256;

export type OctGenerate = {
  size: OctSize;
  type: "oct";
};

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
