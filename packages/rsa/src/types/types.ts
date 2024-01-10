import { KeySetDer, KeySetJwk, KeySetPem } from "@lindorm-io/jwk";

export type BufferFormat = "base64" | "base64url" | "hex";

export type KeyObject = KeySetDer | KeySetJwk | KeySetPem;

export type SignatureAlgorithm =
  | "RSA-SHA256"
  | "RSA-SHA384"
  | "RSA-SHA512"
  | "sha256"
  | "sha384"
  | "sha512";
