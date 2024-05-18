import { Optional } from "@lindorm/types";
import { EcGenerate } from "./ec";
import { OctGenerate } from "./oct";
import { OkpGenerate } from "./okp";
import { RsaGenerate, RsaModulus } from "./rsa";
import {
  KryptosAlgorithm,
  KryptosCurve,
  KryptosOperation,
  KryptosType,
  KryptosUse,
} from "./types";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm;
  createdAt: Date;
  curve: KryptosCurve | undefined;
  expiresAt: Date;
  isExternal: boolean;
  issuer: string | undefined;
  jwksUri: string | undefined;
  notBefore: Date;
  operations: Array<KryptosOperation>;
  ownerId: string | undefined;
  type: KryptosType;
  updatedAt: Date;
  use: KryptosUse;
};

export type KryptosMetadata = {
  expiresIn: number;
  hasPrivateKey: boolean;
  hasPublicKey: boolean;
  isActive: boolean;
  isExpired: boolean;
  isUsable: boolean;
  modulus: RsaModulus | undefined;
};

export type KryptosLike = Partial<KryptosAttributes>;

type StdOptions = Optional<
  KryptosAttributes,
  | "id"
  | "createdAt"
  | "curve"
  | "expiresAt"
  | "isExternal"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "operations"
  | "ownerId"
  | "updatedAt"
>;

export type KryptosKeys = {
  privateKey?: Buffer;
  publicKey?: Buffer;
};

export type KryptosOptions = StdOptions & KryptosKeys;

type StdGenerate = Pick<
  StdOptions,
  "expiresAt" | "issuer" | "jwksUri" | "notBefore" | "operations" | "ownerId"
>;

export type GenerateEcOptions = StdGenerate & EcGenerate;

export type GenerateOctOptions = StdGenerate & OctGenerate;

export type GenerateOkpOptions = StdGenerate & OkpGenerate;

export type GenerateRsaOptions = StdGenerate & RsaGenerate;

export type GenerateKryptosOptions =
  | GenerateEcOptions
  | GenerateOctOptions
  | GenerateOkpOptions
  | GenerateRsaOptions;
