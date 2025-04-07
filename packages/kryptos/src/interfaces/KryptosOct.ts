import { OctAlgorithm, OctBuffer, OctJwk, OctString } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosOct extends IKryptos {
  algorithm: OctAlgorithm;
  curve: undefined;
  type: "oct";

  export(format: "b64"): OctString;
  export(format: "der"): OctBuffer;
  export(format: "jwk"): OctJwk;
  export(format: "pem"): OctString;
}
