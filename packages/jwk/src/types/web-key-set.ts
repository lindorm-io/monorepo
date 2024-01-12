import { KeySetAlgorithm } from "./algorithms";
import { EllipticCurve } from "./ec";
import { KeySetB64, KeySetDer, KeySetJwk, KeySetPem } from "./key-set";
import { OctKeySize } from "./oct";
import { OctetCurve } from "./okp";
import { RsaModulusOption as RsaModulusSize } from "./rsa";
import { KeySetCurve, KeySetOperations, KeySetType, KeySetUsage } from "./types";

export type CreateKeySetOptions = KeySetB64 | KeySetDer | KeySetJwk | KeySetPem;

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
  modulus: RsaModulusSize;
  type: "RSA";
};

export type GenerateKeySetOptions =
  | GenerateEcOptions
  | GenerateOctOptions
  | GenerateOkpOptions
  | GenerateRsaOptions;

export type WebKeySetMetadata = {
  id: string;
  algorithm: KeySetAlgorithm;
  createdAt: Date;
  curve: KeySetCurve | undefined;
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  isExternal: boolean;
  jwkUri: string | undefined;
  notBefore: Date;
  operations: Array<KeySetOperations>;
  ownerId: string | undefined;
  type: KeySetType;
  updatedAt: Date;
  use: KeySetUsage;
};

export type GenerateOptions = GenerateKeySetOptions & {
  id?: string;
  algorithm: KeySetAlgorithm;
  expiresAt?: Date;
  jwkUri?: string;
  notBefore?: Date;
  operations?: Array<KeySetOperations>;
  ownerId?: string;
  use: KeySetUsage;
};

export type WebKeySetOptions = {
  id?: string;
  algorithm: KeySetAlgorithm;
  createdAt?: Date;
  curve?: KeySetCurve;
  expiresAt?: Date;
  isExternal?: boolean;
  jwkUri?: string;
  notBefore?: Date;
  operations?: Array<KeySetOperations>;
  ownerId?: string;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KeySetType;
  updatedAt?: Date;
  use: KeySetUsage;
};
