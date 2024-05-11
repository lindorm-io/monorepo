import { EcCurve } from "./ec";
import { OkpCurve } from "./okp";
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
