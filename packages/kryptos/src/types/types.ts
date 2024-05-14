import { JweAlgorithm, JwtAlgorithm } from "./algorithm";
import { EcCurve } from "./ec";
import { OkpCurve } from "./okp";

export type KryptosAlgorithm = JwtAlgorithm | JweAlgorithm;

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
