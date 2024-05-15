import { KryptosError } from "../../../errors";
import {
  EcJwk,
  KryptosDer,
  KryptosFromJwk,
  OctJwk,
  OkpJwk,
  RsaJwk,
} from "../../../types";
import { _createEcDerFromJwk } from "../ec/der-from-jwk";
import { _createOctDerFromJwk } from "../oct/der-from-jwk";
import { _createOkpDerFromJwk } from "../okp/der-from-jwk";
import { _createRsaDerFromJwk } from "../rsa/der-from-jwk";

export const _createDerFromJwk = (options: KryptosFromJwk): KryptosDer => {
  switch (options.kty) {
    case "EC":
      return {
        ..._createEcDerFromJwk(options as EcJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "oct":
      return {
        ..._createOctDerFromJwk(options as OctJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "OKP":
      return {
        ..._createOkpDerFromJwk(options as OkpJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "RSA":
      return {
        ..._createRsaDerFromJwk(options as RsaJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
