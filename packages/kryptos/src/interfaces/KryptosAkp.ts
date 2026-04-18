import { AkpAlgorithm, AkpBuffer, AkpJwk, AkpString } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosAkp extends IKryptos {
  algorithm: AkpAlgorithm;
  type: "AKP";

  export(format: "b64"): AkpString;
  export(format: "der"): AkpBuffer;
  export(format: "jwk"): AkpJwk;
  export(format: "pem"): AkpString;
}
