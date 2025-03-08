import { KryptosUse } from "../types";

export type RsaEncAlgorithm =
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512";

export type RsaSigAlgorithm = "RS256" | "RS384" | "RS512" | "PS256" | "PS384" | "PS512";

export type RsaAlgorithm = RsaEncAlgorithm | RsaSigAlgorithm;

export type RsaModulus = 1024 | 2048 | 3072 | 4096;

export type RsaString = {
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
