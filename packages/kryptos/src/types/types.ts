import { EcAlgorithm, EcCurve } from "./ec";
import { OctAlgorithm } from "./oct";
import { OkpAlgorithm, OkpCurve } from "./okp";
import { RsaAlgorithm } from "./rsa";

export type KryptosAlgorithm = EcAlgorithm | OctAlgorithm | OkpAlgorithm | RsaAlgorithm;

export type KryptosCurve = EcCurve | OkpCurve;

export type KryptosExportMode = "both" | "public";

export type KryptosFormat = "b64" | "der" | "jwk" | "pem" | "raw";

export type KryptosOperation =
  | "decrypt"
  | "deriveBits"
  | "deriveKey"
  | "encrypt"
  | "sign"
  | "unwrapKey"
  | "verify"
  | "wrapKey";

export type KryptosType = "EC" | "oct" | "OKP" | "RSA";

export type KryptosUse = "enc" | "sig";
