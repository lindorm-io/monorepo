import { KeySetAlgorithm } from "./algorithms";
import { KeySetJwk } from "./key-set";
import { KeySetOperations, KeySetUsage } from "./types";

export type JwkMetadata = {
  alg: KeySetAlgorithm;
  use: KeySetUsage;

  // specific for private keys
  key_ops: Array<KeySetOperations>;
};

export type LindormJwkMetadata = {
  exp?: number;
  expires_in?: number;
  iat: number;
  jku?: string;
  nbf: number;
  owner_id?: string;
  uat: number;
};

export type PublicJwk = KeySetJwk & JwkMetadata;

export type LindormJwk = PublicJwk & LindormJwkMetadata;

export type ExternalJwk = PublicJwk & Partial<LindormJwk>;
