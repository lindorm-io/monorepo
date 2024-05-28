import { EcAlgorithm, EcB64, EcCurve, EcDer, EcJwk, EcPem } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosEc extends IKryptos {
  algorithm: EcAlgorithm;
  curve: EcCurve;
  type: "EC";

  export(format: "b64"): EcB64;
  export(format: "der"): EcDer;
  export(format: "jwk"): EcJwk;
  export(format: "pem"): EcPem;
}
