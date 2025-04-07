import { KryptosUse } from "../types";

export const RSA_ENC_ALGORITHMS = [
  "RSA-OAEP",
  "RSA-OAEP-256",
  "RSA-OAEP-384",
  "RSA-OAEP-512",
] as const;

export const RSA_SIG_ALGORITHMS = [
  "RS256",
  "RS384",
  "RS512",
  "PS256",
  "PS384",
  "PS512",
] as const;

export const RSA_MODULUS = [1024, 2048, 3072, 4096] as const;

export type RsaEncAlgorithm = (typeof RSA_ENC_ALGORITHMS)[number];

export type RsaSigAlgorithm = (typeof RSA_SIG_ALGORITHMS)[number];

export type RsaAlgorithm = RsaEncAlgorithm | RsaSigAlgorithm;

export type RsaModulus = (typeof RSA_MODULUS)[number];

export type RsaString = {
  id: string;
  algorithm: RsaAlgorithm;
  privateKey?: string;
  publicKey: string;
  type: "RSA";
  use: KryptosUse;
};

export type RsaBuffer = {
  id: string;
  algorithm: RsaAlgorithm;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "RSA";
  use: KryptosUse;
};

export type RsaJwk = {
  kid: string;
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
