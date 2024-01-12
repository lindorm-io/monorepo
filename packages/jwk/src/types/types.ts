import { EllipticCurve } from "./ec";
import { OctetCurve } from "./okp";

export type KeySetCurve = EllipticCurve | OctetCurve;

export type KeySetExportFormat = "b64" | "der" | "jwk" | "pem" | "raw";

export type KeySetExportKeys = "both" | "public";

export type KeySetOperations =
  | "decrypt"
  | "deriveBits"
  | "deriveKey"
  | "encrypt"
  | "sign"
  | "unwrapKey"
  | "verify"
  | "wrapKey";

export type KeySetType = "EC" | "RSA" | "OKP" | "oct";

export type KeySetUsage = "enc" | "sig";
