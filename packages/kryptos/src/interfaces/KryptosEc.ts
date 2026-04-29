import type { EcAlgorithm, EcBuffer, EcCurve, EcJwk, EcString } from "../types/index.js";
import type { IKryptos } from "./Kryptos.js";

export interface IKryptosEc extends IKryptos {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  type: "EC";

  export(format: "b64"): EcString;
  export(format: "der"): EcBuffer;
  export(format: "jwk"): EcJwk;
  export(format: "pem"): EcString;
}
