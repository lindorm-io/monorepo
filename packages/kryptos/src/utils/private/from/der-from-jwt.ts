import { KryptosError } from "../../../errors";
import {
  EcJwk,
  KryptosDer,
  KryptosFromJwk,
  OctJwk,
  OkpJwk,
  RsaJwk,
} from "../../../types";
import { createEcDerFromJwk } from "../ec/der-from-jwk";
import { createOctDerFromJwk } from "../oct/der-from-jwk";
import { createOkpDerFromJwk } from "../okp/der-from-jwk";
import { createRsaDerFromJwk } from "../rsa/der-from-jwk";

export const createDerFromJwk = (options: KryptosFromJwk): KryptosDer => {
  switch (options.kty) {
    case "EC":
      return {
        ...createEcDerFromJwk(options as EcJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "oct":
      return {
        ...createOctDerFromJwk(options as OctJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromJwk(options as OkpJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromJwk(options as RsaJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
