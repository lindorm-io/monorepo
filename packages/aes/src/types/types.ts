import { KryptosJwk } from "@lindorm/kryptos";

export type AesInternalEncryption =
  | "aes-128-cbc"
  | "aes-192-cbc"
  | "aes-256-cbc"
  | "aes-128-gcm"
  | "aes-192-gcm"
  | "aes-256-gcm";

export type PublicEncryptionJwk = Pick<KryptosJwk, "crv" | "kty" | "x" | "y">;
