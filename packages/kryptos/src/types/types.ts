import { EcCurve } from "./ec";
import { OkpCurve } from "./okp";

export type KryptosAlgorithm =
  // EC Keys
  | "ES256"
  | "ES384"
  | "ES512"

  // Oct Keys
  | "HS256"
  | "HS384"
  | "HS512"

  // OKP Keys
  | "EdDSA"
  | "ECDH-ES"

  // RSA Keys
  | "RS256"
  | "RS384"
  | "RS512";

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
