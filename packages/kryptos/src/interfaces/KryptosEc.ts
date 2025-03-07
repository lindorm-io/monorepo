import { EcAlgorithm, EcCurve, EcDer, EcJwk, EcString } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosEc extends IKryptos {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  type: "EC";

  export(format: "b64"): EcString;
  export(format: "der"): EcDer;
  export(format: "jwk"): EcJwk;
  export(format: "pem"): EcString;
}
