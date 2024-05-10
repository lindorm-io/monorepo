import { EcKeyJwk } from "./ec";
import { OctKeyJwk } from "./oct";
import { OkpKeyJwk } from "./okp";
import { RsaKeyJwk } from "./rsa";
import { KryptosCurve, KryptosType } from "./types";

type KryptosString = {
  curve?: KryptosCurve;
  privateKey?: string;
  publicKey?: string;
  type: KryptosType;
};

type KryptosBuffer = {
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};

export type KryptosB64 = KryptosString;

export type KryptosDer = KryptosBuffer;

export type KryptosJwk = EcKeyJwk | OctKeyJwk | OkpKeyJwk | RsaKeyJwk;

export type KryptosPem = KryptosString;

export type KryptosRaw = KryptosBuffer;
