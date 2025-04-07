import { KryptosAlgorithm } from "../algorithm";
import { KryptosCurve } from "../curve";
import { KryptosType, KryptosUse } from "../types";

export type ExportOptions = {
  id: string;
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
  use: KryptosUse;
};
