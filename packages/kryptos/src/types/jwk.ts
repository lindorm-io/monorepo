import { Optional } from "@lindorm/types";
import { KryptosAlgorithm, KryptosOperation, KryptosType, KryptosUse } from "./types";

export type JwkMetadata = {
  alg: KryptosAlgorithm;
  key_ops: Array<KryptosOperation>;
  kid: string;
  kty: KryptosType;
  use: KryptosUse;
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

export type LindormJwk = JwkMetadata & LindormJwkMetadata;

export type UnknownJwk = Optional<JwkMetadata, "kid" | "key_ops"> &
  Partial<LindormJwkMetadata>;
