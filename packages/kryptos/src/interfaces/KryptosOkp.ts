import { OkpAlgorithm, OkpCurve, OkpDer, OkpJwk, OkpString } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosOkp extends IKryptos {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  type: "OKP";

  export(format: "b64"): OkpString;
  export(format: "der"): OkpDer;
  export(format: "jwk"): OkpJwk;
  export(format: "pem"): OkpString;
}
