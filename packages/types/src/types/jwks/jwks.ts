import { AesEncryption } from "../aes";
import { JwksAlgorithm } from "./jwks-algorithm";
import { JwksCurve } from "./jwks-curve";
import { JwksKeyOps } from "./jwks-key-ops";
import { JwksKeyType } from "./jwks-key-type";
import { JwksUse } from "./jwks-use";

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
