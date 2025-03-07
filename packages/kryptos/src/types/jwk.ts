import { Optional } from "@lindorm/types";
import { KryptosAlgorithm } from "./algorithm";
import { KryptosEncryption } from "./encryption";
import { KryptosJwk } from "./kryptos";
import { KryptosOperation } from "./operation";
import { KryptosType, KryptosUse } from "./types";

export type JwkMetadata = {
  alg: KryptosAlgorithm;
  key_ops: Array<KryptosOperation>;
  kid: string;
  kty: KryptosType;
  use: KryptosUse;
};

export type LindormJwkMetadata = {
  enc?: KryptosEncryption;
  exp?: number;
  iat: number;
  iss?: string;
  jku?: string;
  nbf: number;
  owner_id?: string;
  uat: number;
};

export type LindormJwk = JwkMetadata & LindormJwkMetadata & KryptosJwk;

export type UnknownJwk = Optional<JwkMetadata, "kid" | "key_ops"> &
  Partial<LindormJwkMetadata>;
