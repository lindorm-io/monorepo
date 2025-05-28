import { KryptosAlgorithm } from "./algorithm";
import { KryptosCurve } from "./curve";
import { KryptosEncryption } from "./encryption";
import { RsaModulus } from "./key-types";
import { KryptosOperation } from "./operation";
import { KryptosPurpose, KryptosType, KryptosUse } from "./types";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm;
  createdAt: Date;
  curve: KryptosCurve | null;
  encryption: KryptosEncryption | null;
  expiresAt: Date | null;
  hidden: boolean;
  isExternal: boolean;
  issuer: string | null;
  jwksUri: string | null;
  notBefore: Date;
  operations: Array<KryptosOperation>;
  ownerId: string | null;
  purpose: KryptosPurpose | null;
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
  modulus: RsaModulus | null;
};

export type KryptosJSON = KryptosAttributes & KryptosMetadata;

export type KryptosDB = KryptosAttributes & {
  privateKey: string | null | undefined;
  publicKey: string | null | undefined;
};

export type KryptosLike = Partial<KryptosAttributes>;
