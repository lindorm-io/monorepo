import { KryptosCurve, KryptosExportMode, KryptosType } from "./types";

export type FormatOptions = {
  curve?: KryptosCurve;
  mode: KryptosExportMode;
  privateKey?: Buffer;
  publicKey?: Buffer;
  type: KryptosType;
};
