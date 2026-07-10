import type { Optional } from "@lindorm/types";
import type { KryptosAlgorithm } from "./algorithm.js";
import type { KryptosEncryption } from "./encryption.js";
import type { KryptosJwk } from "./kryptos.js";
import type { KryptosOperation } from "./operation.js";
import type { KryptosType, KryptosUse } from "./types.js";

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
  // Operational flag, emitted only in private JWKs (never in the published,
  // public JWKS). Round-trips through env strings so a hidden key stays hidden.
  hidden?: boolean;
  iat: number;
  iss?: string;
  jku?: string;
  nbf: number;
  owner_id?: string;
  purpose?: string;
};

export type LindormJwk = JwkMetadata & LindormJwkMetadata & KryptosJwk;

export type UnknownJwk = Optional<JwkMetadata, "kid" | "key_ops"> &
  Partial<LindormJwkMetadata>;
