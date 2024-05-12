import { EcCurve } from "./ec";
import { OkpCurve } from "./okp";
import { KryptosAlgorithm, KryptosCurve, KryptosOperation, KryptosType, KryptosUse } from "./types";

export type SetKryptosAttributes = {
  id: string;
  algorithm: KryptosAlgorithm | undefined;
  createdAt: Date;
  curve: KryptosCurve | undefined;
  expiresAt: Date | undefined;
  isExternal: boolean;
  issuer: string | undefined;
  jwksUri: string | undefined;
  notBefore: Date;
  operations: Array<KryptosOperation>;
  ownerId: string | undefined;
  type: KryptosType;
  updatedAt: Date;
  use: KryptosUse | undefined;
};

export type CalculatedKryptosAttributes = {
  expiresIn: number | undefined;
  isActive: boolean;
  isExpired: boolean;
  isUsable: boolean;
};

export type KryptosAttributes = SetKryptosAttributes & CalculatedKryptosAttributes;

export type KryptosOptions = Partial<Omit<SetKryptosAttributes, "type">> &
  Pick<SetKryptosAttributes, "type"> & {
    privateKey?: Buffer;
    publicKey?: Buffer;
  };

export type KryptosClone = Omit<KryptosOptions, "privateKey" | "publicKey" | "type">;

export type EcKryptos = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: EcCurve;
  type: "EC";
};

export type OctKryptos = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: undefined;
  type: "oct";
};

export type OkpKryptos = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: OkpCurve;
  type: "OKP";
};

export type RsaKryptos = Omit<KryptosAttributes, "curve" | "type"> & {
  curve: undefined;
  type: "RSA";
};
