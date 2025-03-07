export type KryptosDeriveOperation = "deriveBits" | "deriveKey";

export type KryptosEncOperation = "decrypt" | "encrypt";

export type KryptosSigOperation = "sign" | "verify";

export type KryptosWrapOperation = "unwrapKey" | "wrapKey";

export type KryptosOperation =
  | KryptosDeriveOperation
  | KryptosEncOperation
  | KryptosSigOperation
  | KryptosWrapOperation;
