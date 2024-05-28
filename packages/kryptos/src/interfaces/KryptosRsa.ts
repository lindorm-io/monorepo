import { RsaAlgorithm, RsaB64, RsaDer, RsaJwk, RsaPem } from "../types";
import { IKryptos } from "./Kryptos";

export interface IKryptosRsa extends IKryptos {
  algorithm: RsaAlgorithm;
  curve: undefined;
  type: "RSA";

  export(format: "b64"): RsaB64;
  export(format: "der"): RsaDer;
  export(format: "jwk"): RsaJwk;
  export(format: "pem"): RsaPem;
}
