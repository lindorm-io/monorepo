import { EllipticCurve, JwkAlgorithm, JwkType, JwkUse } from "./types";

export type EcJwkValues = {
  // common
  x: string;
  y: string;
  crv: EllipticCurve;

  // specific for private keys
  d?: string;

  // metadata
  kid?: string;
  kty: "EC";
};

export type RsaJwkValues = {
  // common
  e: string;
  n: string;

  // specific for private keys
  d?: string;
  dp?: string;
  dq?: string;
  p?: string;
  q?: string;
  qi?: string;

  // metadata
  kid?: string;
  kty: "RSA";
};

export type JwkValues = EcJwkValues | RsaJwkValues;

export type JwkMetadata = {
  alg: JwkAlgorithm;
  kid: string;
  kty: JwkType;
  use: JwkUse;

  // specific for private keys
  key_ops?: string[];
};

export type LindormJwkMetadata = {
  created_at: number;
  expires_at: number;
  not_before: number;
  origin_uri: string;
  owner_id: string;
};

export type PublicJwk = JwkValues & JwkMetadata;

export type LindormJwk = PublicJwk & LindormJwkMetadata;
