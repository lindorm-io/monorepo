import { EcKeySet, OctKeySet, OkpKeySet, RsaKeySet } from "../classes";
import { EcKeySetB64, EcKeySetDer, EcKeySetJwk, EcKeySetPem } from "./ec";
import { OctKeySetB64, OctKeySetDer, OctKeySetJwk, OctKeySetPem } from "./oct";
import { OkpKeySetB64, OkpKeySetDer, OkpKeySetJwk, OkpKeySetPem } from "./okp";
import { RsaKeySetB64, RsaKeySetDer, RsaKeySetJwk, RsaKeySetPem } from "./rsa";

export type KeySet = EcKeySet | OctKeySet | OkpKeySet | RsaKeySet;

export type KeySetB64 = EcKeySetB64 | OctKeySetB64 | OkpKeySetB64 | RsaKeySetB64;

export type KeySetDer = EcKeySetDer | OctKeySetDer | OkpKeySetDer | RsaKeySetDer;

export type KeySetJwk = EcKeySetJwk | OctKeySetJwk | OkpKeySetJwk | RsaKeySetJwk;

export type KeySetPem = EcKeySetPem | OctKeySetPem | OkpKeySetPem | RsaKeySetPem;
