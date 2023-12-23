import { EcJwkValues, JwkValues, PemValues } from "@lindorm-io/jwk";

export type AesEncryptionKey = JwkValues | PemValues;

export type AesPublicJwk = Pick<EcJwkValues, "crv" | "x" | "y">;

export type AesSecret = Buffer | string;
