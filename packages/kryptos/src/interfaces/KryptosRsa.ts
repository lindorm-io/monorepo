import { RsaAlgorithm, RsaBuffer, RsaJwk, RsaString } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosRsa extends IKryptos {
  algorithm: RsaAlgorithm;
  curve: undefined;
  type: "RSA";

  export(format: "b64"): RsaString;
  export(format: "der"): RsaBuffer;
  export(format: "jwk"): RsaJwk;
  export(format: "pem"): RsaString;
}
