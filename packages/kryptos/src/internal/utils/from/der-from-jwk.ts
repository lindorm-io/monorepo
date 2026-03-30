import { randomUUID } from "crypto";
import { KryptosError } from "../../../errors";
import {
  EcJwk,
  KryptosBuffer,
  KryptosFromJwk,
  OctJwk,
  OkpJwk,
  RsaJwk,
} from "../../../types";
import { createEcDerFromJwk } from "../ec/der-from-jwk";
import { createOctDerFromJwk } from "../oct/der-from-jwk";
import { createOkpDerFromJwk } from "../okp/der-from-jwk";
import { createRsaDerFromJwk } from "../rsa/der-from-jwk";

export const createDerFromJwk = (options: KryptosFromJwk): KryptosBuffer => {
  switch (options.kty) {
    case "EC":
      return {
        ...createEcDerFromJwk(options as EcJwk),
        id: options.kid || randomUUID(),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "oct":
      return {
        ...createOctDerFromJwk(options as OctJwk),
        id: options.kid || randomUUID(),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromJwk(options as OkpJwk),
        id: options.kid || randomUUID(),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromJwk(options as RsaJwk),
        id: options.kid || randomUUID(),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
