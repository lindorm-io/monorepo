import { AesCipherAlgorithm, AesCipherFormat } from "./aes-cipher";
import {
  ArgonSignatureHashLength,
  ArgonSignatureMemoryCost,
  ArgonSignatureSaltLength,
} from "./argon-signature";
import { EccSignatureAlgorithm, EccSignatureFormat } from "./ecc-signature";
import { HmacSignatureAlgorithm, HmacSignatureFormat } from "./hmac-signature";
import { RsaSignatureAlgorithm, RsaSignatureFormat } from "./rsa-signature";
import { ShaHashAlgorithm, ShaHashFormat } from "./sha-hash";

export type CryptoAesOptions = {
  algorithm?: AesCipherAlgorithm;
  format?: AesCipherFormat;
  secret: string;
};

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
  aes: CryptoAesOptions;
  argon?: CryptoArgonOptions;
  hmac: CryptoHmacOptions;
};

export type CryptoRsaOptions = {
  algorithm?: RsaSignatureAlgorithm;
  format?: RsaSignatureFormat;
  passphrase?: string;
  privateKey?: string;
  publicKey?: string;
};

export type CryptoSecretOptions = {
  aes: CryptoAesOptions;
  hmac: CryptoHmacOptions;
};

export type CryptoShaOptions = {
  algorithm?: ShaHashAlgorithm;
  format?: ShaHashFormat;
};
