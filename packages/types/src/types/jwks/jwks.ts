import type { AesEncryption } from "../aes-encryption.js";
import type { JwksAlgorithm } from "./jwks-algorithm.js";
import type { JwksCurve } from "./jwks-curve.js";
import type { JwksKeyOps } from "./jwks-key-ops.js";
import type { JwksKeyType } from "./jwks-key-type.js";
import type { JwksUse } from "./jwks-use.js";

export type LindormJwks = {
  enc: AesEncryption;
  exp?: number;
  iat: number;
  iss: string;
  jku: string;
  nbf: number;
  owner_id?: string;
  uat: number;
};

export type Jwks = Partial<LindormJwks> & {
  alg: JwksAlgorithm;
  crv?: JwksCurve;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  k?: string;
  keyOps: Array<JwksKeyOps>;
  kid: string;
  kty: JwksKeyType;
  n?: string;
  p?: string;
  q?: string;
  qi?: string;
  use: JwksUse;
  x?: string;
  y?: string;
};
