import { KryptosAlgorithm } from "../../types/algorithm";
import { KryptosCurve } from "../../types/curve";
import { KryptosType, KryptosUse } from "../../types/types";

export type ExportOptions = {
  id: string;
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
  use: KryptosUse;
};
