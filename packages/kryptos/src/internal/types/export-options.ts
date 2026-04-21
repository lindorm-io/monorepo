import type { KryptosAlgorithm } from "../../types/algorithm.js";
import type { KryptosCurve } from "../../types/curve.js";
import type { KryptosType, KryptosUse } from "../../types/types.js";

export type ExportOptions = {
  id: string;
  algorithm: KryptosAlgorithm;
  curve?: KryptosCurve;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
  use: KryptosUse;
};
