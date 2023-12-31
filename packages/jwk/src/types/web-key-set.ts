import { KeySetAlgorithm } from "./algorithms";
import { EllipticCurve } from "./ec";
import { JwkOperations, JwkType, JwkUsage } from "./jwk";
import { KeySetCurve, KeySetDer, KeySetJwk, KeySetPem } from "./key-set";
import { OctKeySize } from "./oct";
import { OctetCurve } from "./okp";

export type CreateKeySetOptions = KeySetDer | KeySetJwk | KeySetPem;

export type GenerateEcOptions = {
  curve: EllipticCurve;
  type: "EC";
};

export type GenerateOctOptions = {
  size: OctKeySize;
  type: "oct";
};

export type GenerateOkpOptions = {
  curve: OctetCurve;
  type: "OKP";
};

export type GenerateRsaOptions = {
  modulus: 1 | 2 | 3 | 4;
  type: "RSA";
};

export type GenerateKeySetOptions =
  | GenerateEcOptions
  | GenerateOctOptions
  | GenerateOkpOptions
  | GenerateRsaOptions;

export type GenerateOptions = GenerateKeySetOptions & {
  algorithm: KeySetAlgorithm;
  expiresAt?: Date;
  notBefore?: Date;
  operations?: Array<JwkOperations>;
  ownerId?: string;
  use: JwkUsage;
};

export type WebKeySetOptions = {
  algorithm: KeySetAlgorithm;
  createdAt?: Date;
  curve?: KeySetCurve;
  expiresAt?: Date;
  isExternal?: boolean;
  jwkUri?: string;
  keyId?: string;
  notBefore?: Date;
  operations?: Array<JwkOperations>;
  ownerId?: string;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: JwkType;
  use: JwkUsage;
};
