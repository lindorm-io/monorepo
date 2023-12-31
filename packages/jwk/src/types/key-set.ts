import { EcKeySet, OctKeySet, OkpKeySet, RsaKeySet } from "../classes";
import { EcKeySetDer, EcKeySetJwk, EcKeySetPem, EllipticCurve } from "./ec";
import { OctKeySetDer, OctKeySetJwk, OctKeySetPem } from "./oct";
import { OctetCurve, OkpKeySetDer, OkpKeySetJwk, OkpKeySetPem } from "./okp";
import { RsaKeySetDer, RsaKeySetJwk, RsaKeySetPem } from "./rsa";

export type KeySetExportFormat = "der" | "jwk" | "pem" | "raw";

export type KeySetExportKeys = "both" | "public";

export type KeySet = EcKeySet | OctKeySet | OkpKeySet | RsaKeySet;

export type KeySetCurve = EllipticCurve | OctetCurve;

export type KeySetDer = EcKeySetDer | OctKeySetDer | OkpKeySetDer | RsaKeySetDer;

export type KeySetJwk = EcKeySetJwk | OctKeySetJwk | OkpKeySetJwk | RsaKeySetJwk;

export type KeySetPem = EcKeySetPem | OctKeySetPem | OkpKeySetPem | RsaKeySetPem;
