import { KryptosUse } from "./types";

export type RsaSigAlgorithm = "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512";

export type RsaEncAlgorithm =
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512";

export type RsaAlgorithm = RsaEncAlgorithm | RsaSigAlgorithm;

export type RsaModulus = 1024 | 2048 | 3072 | 4096;

export type RsaSize = 1 | 2 | 3 | 4;

export type RsaGenerate = {
  size: RsaSize;
  type: "RSA";
};

export type RsaB64 = {
  algorithm: RsaAlgorithm;
  privateKey?: string;
  publicKey: string;
  type: "RSA";
  use: KryptosUse;
};

export type RsaDer = {
  algorithm: RsaAlgorithm;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "RSA";
  use: KryptosUse;
};

export type RsaJwk = {
  alg: RsaAlgorithm;
  e: string;
  n: string;
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;
  kty: "RSA";
  use: KryptosUse;
};

export type RsaPem = {
  algorithm: RsaAlgorithm;
  privateKey?: string;
  publicKey: string;
  type: "RSA";
  use: KryptosUse;
};
