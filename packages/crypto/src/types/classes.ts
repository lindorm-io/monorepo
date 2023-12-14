import { AesCipherOptions } from "@lindorm-io/aes";
import {
  ArgonSignatureHashLength,
  ArgonSignatureMemoryCost,
  ArgonSignatureSaltLength,
} from "./argon-signature";
import { EccSignatureAlgorithm, EccSignatureFormat } from "./ecc-signature";
import { HmacSignatureAlgorithm, HmacSignatureFormat } from "./hmac-signature";
import { ShaHashAlgorithm, ShaHashFormat } from "./sha-hash";

export type CryptoArgonOptions = {
  hashLength?: ArgonSignatureHashLength;
  memoryCost?: ArgonSignatureMemoryCost;
  parallelism?: number;
  saltLength?: ArgonSignatureSaltLength;
  secret?: string;
  timeCost?: number;
};

export type CryptoEccOptions = {
  algorithm?: EccSignatureAlgorithm;
  format?: EccSignatureFormat;
  privateKey?: string;
  publicKey?: string;
};

export type CryptoHmacOptions = {
  algorithm?: HmacSignatureAlgorithm;
  format?: HmacSignatureFormat;
  secret: string;
};

export type CryptoLayeredOptions = {
  aes: AesCipherOptions;
  argon?: CryptoArgonOptions;
  hmac: CryptoHmacOptions;
};

export type CryptoSecretOptions = {
  aes: AesCipherOptions;
  hmac: CryptoHmacOptions;
};

export type CryptoShaOptions = {
  algorithm?: ShaHashAlgorithm;
  format?: ShaHashFormat;
};
