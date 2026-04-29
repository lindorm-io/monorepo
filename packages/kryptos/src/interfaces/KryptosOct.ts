import type { OctAlgorithm, OctBuffer, OctJwk, OctString } from "../types/index.js";
import type { IKryptos } from "./Kryptos.js";

export interface IKryptosOct extends IKryptos {
  algorithm: OctAlgorithm;
  curve: null;
  type: "oct";

  export(format: "b64"): OctString;
  export(format: "der"): OctBuffer;
  export(format: "jwk"): OctJwk;
  export(format: "pem"): OctString;
}
