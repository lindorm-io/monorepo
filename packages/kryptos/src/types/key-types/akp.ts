import { KryptosUse } from "../types";

export const AKP_SIG_ALGORITHMS = ["ML-DSA-44", "ML-DSA-65", "ML-DSA-87"] as const;

export type AkpSigAlgorithm = (typeof AKP_SIG_ALGORITHMS)[number];
export type AkpAlgorithm = AkpSigAlgorithm;

export type AkpString = {
  id: string;
  algorithm: AkpAlgorithm;
  privateKey?: string;
  publicKey: string;
  type: "AKP";
  use: KryptosUse;
};

export type AkpBuffer = {
  id: string;
  algorithm: AkpAlgorithm;
  privateKey?: Buffer;
  publicKey: Buffer;
  type: "AKP";
  use: KryptosUse;
};

export type AkpJwk = {
  kid: string;
  alg: AkpAlgorithm;
  kty: "AKP";
  pub: string;
  priv?: string;
  use: KryptosUse;
};
