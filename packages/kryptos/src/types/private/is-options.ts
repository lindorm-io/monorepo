import { KryptosCurve, KryptosType } from "../types";

export type _IsBufferFormatOptions = {
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};

export type _IsJwkFormatOptions = {
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

export type _IsStringFormatOptions = {
  curve?: KryptosCurve;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};
