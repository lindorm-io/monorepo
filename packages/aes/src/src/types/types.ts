import { EcKeyJwk } from "@lindorm/kryptos";

export type BufferFormat = "base64" | "base64url" | "hex";

export type Encryption =
  | "aes-128-cbc"
  | "aes-192-cbc"
  | "aes-256-cbc"
  | "aes-128-gcm"
  | "aes-192-gcm"
  | "aes-256-gcm";

export type EncryptionKeyAlgorithm =
  | "ECDH-ES"
  | "RSA-OAEP"
  | "RSA-OAEP-256"
  | "RSA-OAEP-384"
  | "RSA-OAEP-512"
  | "RSA-PRIVATE-KEY";

export type IntegrityHash = "sha256" | "sha384" | "sha512";

export type PublicEncryptionJwk = Pick<EcKeyJwk, "crv" | "kty" | "x" | "y">;

export type Secret = Buffer | string;

export type ShaHash = "sha1" | "sha256" | "sha384" | "sha512";
