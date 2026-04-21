import type { AkpAlgorithm, AkpBuffer, AkpJwk, AkpString } from "../types/index.js";
import type { IKryptos } from "./Kryptos.js";

export interface IKryptosAkp extends IKryptos {
  algorithm: AkpAlgorithm;
  type: "AKP";

  export(format: "b64"): AkpString;
  export(format: "der"): AkpBuffer;
  export(format: "jwk"): AkpJwk;
  export(format: "pem"): AkpString;
}
