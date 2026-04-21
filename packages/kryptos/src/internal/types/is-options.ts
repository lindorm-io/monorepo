import type { KryptosCurve } from "../../types/curve.js";
import type { KryptosType } from "../../types/types.js";

export type IsBufferFormatOptions = {
  curve?: KryptosCurve | null;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};

export type IsJwkFormatOptions = {
  crv?: KryptosCurve | null;
  d?: string;
  dp?: string;
  dq?: string;
  e?: string;
  k?: string;
  kty: KryptosType;
  n?: string;
  p?: string;
  priv?: string;
  pub?: string;
  q?: string;
  qi?: string;
  x?: string;
  y?: string;
};

export type IsStringFormatOptions = {
  curve?: KryptosCurve | null;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};
