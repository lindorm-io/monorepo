import { KryptosJwk } from "./combined";
import { KryptosAlgorithm, KryptosOperation, KryptosUse } from "./types";

export type JwkMetadata = {
  alg: KryptosAlgorithm;
  kid: string;
  use: KryptosUse;

  // specific for private keys
  key_ops: Array<KryptosOperation>;
};

export type LindormJwkMetadata = {
  exp?: number;
  iat: number;
  iss?: string;
  jku?: string;
  nbf: number;
  owner_id?: string;
  uat: number;
};

export type LindormJwk = KryptosJwk & JwkMetadata & LindormJwkMetadata;
