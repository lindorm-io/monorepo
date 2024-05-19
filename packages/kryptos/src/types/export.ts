import { KryptosEncryption } from "./encryption";
import { KryptosAlgorithm, KryptosCurve, KryptosType, KryptosUse } from "./types";

export type KryptosB64 = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
  privateKey?: string;
  publicKey: string;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosDer = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
  privateKey?: Buffer;
  publicKey: Buffer;
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

export type KryptosPem = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  encryption?: KryptosEncryption;
  privateKey?: string;
  publicKey: string;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosKey = KryptosB64 | KryptosDer | KryptosJwk | KryptosPem;
