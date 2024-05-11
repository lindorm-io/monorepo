import { EcKeyJwk } from "./ec";
import { OctKeyJwk } from "./oct";
import { OkpKeyJwk } from "./okp";
import { RsaKeyJwk } from "./rsa";
import { KryptosCurve, KryptosType } from "./types";

export type KryptosB64 = {
  curve?: KryptosCurve;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};

export type KryptosDer = {
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};

export type KryptosJwk = EcKeyJwk | OctKeyJwk | OkpKeyJwk | RsaKeyJwk;

export type KryptosPem = {
  curve?: KryptosCurve;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};

export type KryptosRaw = {
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};
