import type { RsaAlgorithm, RsaBuffer, RsaJwk, RsaString } from "../types/index.js";
import type { IKryptos } from "./Kryptos.js";

export interface IKryptosRsa extends IKryptos {
  algorithm: RsaAlgorithm;
  curve: null;
  type: "RSA";

  export(format: "b64"): RsaString;
  export(format: "der"): RsaBuffer;
  export(format: "jwk"): RsaJwk;
  export(format: "pem"): RsaString;
}
