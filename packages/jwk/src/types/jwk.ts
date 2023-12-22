import { EllipticCurve, JwkAlgorithm, JwkOps, JwkType, JwkUse } from "./types";

// 'OKP': Refers to Octet Key Pair, used for keys like Ed25519.

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

export type OctJwkValues = {
  // common
  k: string;

  // metadata
  kid?: string;
  kty: "oct";
};

// export type OkpJwkValues = {
//   // common
//   x: string;
//   crv: string; // Curve name, e.g., "Ed25519"

//   // specific for private keys
//   d?: string;

//   // metadata
//   kid?: string;
//   kty: "OKP";
// };

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

export type JwkValues = EcJwkValues | OctJwkValues | RsaJwkValues;

export type JwkMetadata = {
  alg: JwkAlgorithm;
  kid: string;
  kty: JwkType;
  use: JwkUse;

  // specific for private keys
  key_ops: Array<JwkOps>;
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
