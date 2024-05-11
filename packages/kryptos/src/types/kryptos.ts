import { KryptosAlgorithm, KryptosCurve, KryptosOperation, KryptosType, KryptosUse } from "./types";

export type KryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm | undefined;
  createdAt: Date;
  curve: KryptosCurve | undefined;
  expiresAt: Date | undefined;
  expiresIn: number | undefined;
  isExpired: boolean;
  isExternal: boolean;
  isUsable: boolean;
  jwksUri: string | undefined;
  notBefore: Date;
  operations: Array<KryptosOperation>;
  ownerId: string | undefined;
  type: KryptosType;
  updatedAt: Date;
  use: KryptosUse | undefined;
};

export type KryptosOptions = Partial<Omit<KryptosAttributes, "type">> &
  Pick<KryptosAttributes, "type"> & {
    privateKey?: Buffer;
    publicKey?: Buffer;
  };

export type EcKryptosAttributes = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: "P-256" | "P-384" | "P-521" | "secp256k1" | "secp384r1" | "secp521r1";
  type: "EC";
};

export type OctKryptosAttributes = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: undefined;
  type: "oct";
};

export type OkpKryptosAttributes = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: "Ed25519" | "X25519";
  type: "OKP";
};

export type RsaKryptosAttributes = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: undefined;
  type: "RSA";
};
