import { EcJwk } from "@lindorm/kryptos";

export type AesEncryption =
  | "aes-128-cbc"
  | "aes-192-cbc"
  | "aes-256-cbc"
  | "aes-128-gcm"
  | "aes-192-gcm"
  | "aes-256-gcm";

export type AesEncryptionKeyAlgorithm =
  | "ECDH-ES"
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512"
  | "RSA-PRIVATE-KEY";

export type PublicEncryptionJwk = Pick<EcJwk, "crv" | "kty" | "x" | "y">;

export type AesSecret = Buffer | string;
