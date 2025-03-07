import { KryptosCurve } from "../curve";
import { KryptosType } from "../types";

export type IsBufferFormatOptions = {
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};

export type IsJwkFormatOptions = {
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
  x?: string;
  y?: string;
};

export type IsStringFormatOptions = {
  curve?: KryptosCurve;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};
