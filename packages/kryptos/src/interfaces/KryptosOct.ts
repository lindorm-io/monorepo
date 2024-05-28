import { OctAlgorithm, OctB64, OctDer, OctJwk, OctPem } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosOct extends IKryptos {
  algorithm: OctAlgorithm;
  curve: undefined;
  type: "oct";

  export(format: "b64"): OctB64;
  export(format: "der"): OctDer;
  export(format: "jwk"): OctJwk;
  export(format: "pem"): OctPem;
}
