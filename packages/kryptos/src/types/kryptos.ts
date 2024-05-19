import { Optional } from "@lindorm/types";
import { EcGenerate } from "./ec";
import { KryptosEncryption } from "./encryption";
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
  encryption: KryptosEncryption | undefined;
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
  | "encryption"
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

export type GenerateKryptosConfig = EcGenerate | OctGenerate | OkpGenerate | RsaGenerate;

export type GenerateKryptosOptions = Pick<
  StdOptions,
  | "encryption"
  | "expiresAt"
  | "issuer"
  | "jwksUri"
  | "notBefore"
  | "operations"
  | "ownerId"
>;
