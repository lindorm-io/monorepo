import type { KryptosAlgorithm } from "./algorithm.js";
import type { KryptosCurve } from "./curve.js";
import type { KryptosEncryption } from "./encryption.js";
import type { RsaModulus } from "./key-types/index.js";
import type { KryptosOperation } from "./operation.js";
import type { KryptosType, KryptosUse } from "./types.js";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm;
  certificateChain: Array<string>;
  createdAt: Date;
  curve: KryptosCurve | null;
  encryption: KryptosEncryption | null;
  expiresAt: Date;
  hidden: boolean;
  isExternal: boolean;
  issuer: string | null;
  jwksUri: string | null;
  notBefore: Date;
  operations: Array<KryptosOperation>;
  ownerId: string | null;
  purpose: string | null;
  type: KryptosType;
  use: KryptosUse;
};

export type KryptosMetadata = {
  certificateThumbprint: string | null;
  expiresIn: number;
  hasCertificate: boolean;
  hasPrivateKey: boolean;
  hasPublicKey: boolean;
  isActive: boolean;
  isExpired: boolean;
  modulus: RsaModulus | null;
  thumbprint: string;
};

export type KryptosJSON = KryptosAttributes & KryptosMetadata;

export type KryptosDB = KryptosAttributes & {
  privateKey: string | null | undefined;
  publicKey: string | null | undefined;
};

export type KryptosLike = Partial<KryptosAttributes>;
