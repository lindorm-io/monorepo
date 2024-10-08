import { KryptosAlgorithm, KryptosCurve, KryptosType, KryptosUse } from "../types";

export type ExportOptions = {
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
  use: KryptosUse;
};
