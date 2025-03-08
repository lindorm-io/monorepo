import { KryptosAlgorithm } from "./algorithm";
import { KryptosCurve } from "./curve";
import { KryptosEncryption } from "./encryption";
import { KryptosType, KryptosUse } from "./types";

export type KryptosString = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosBuffer = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosJwk = {
  alg: KryptosAlgorithm;
  enc?: KryptosEncryption;
  crv?: KryptosCurve;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  k?: string;
  kty: KryptosType;
  n?: string;
  p?: string;
  q?: string;
  qi?: string;
  use: KryptosUse;
  x?: string;
  y?: string;
};

export type KryptosKey = KryptosString | KryptosBuffer | KryptosJwk;
