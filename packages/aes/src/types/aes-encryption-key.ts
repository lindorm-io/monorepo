import { JwkValues, PemValues } from "@lindorm-io/jwk";

export type AesSecret = Buffer | string;

export type AesEncryptionKey = JwkValues | PemValues;
