import { Optional } from "@lindorm/types";
import { KryptosAlgorithm } from "./algorithm";
import { KryptosCurve } from "./curve";
import { KryptosEncryption } from "./encryption";
import { RsaModulus } from "./key-types";
import { KryptosOperation } from "./operation";
import { KryptosType, KryptosUse } from "./types";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm;
  createdAt: Date;
  curve: KryptosCurve | undefined;
  encryption: KryptosEncryption | undefined;
  expiresAt: Date | undefined;
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
