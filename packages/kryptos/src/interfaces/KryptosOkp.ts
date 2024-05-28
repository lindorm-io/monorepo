import { OkpAlgorithm, OkpB64, OkpCurve, OkpDer, OkpJwk, OkpPem } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosOkp extends IKryptos {
  algorithm: OkpAlgorithm;
  curve: OkpCurve;
  type: "OKP";

  export(format: "b64"): OkpB64;
  export(format: "der"): OkpDer;
  export(format: "jwk"): OkpJwk;
  export(format: "pem"): OkpPem;
}
