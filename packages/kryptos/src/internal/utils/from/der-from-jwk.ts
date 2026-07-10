import { KryptosError } from "../../../errors/index.js";
import type {
  AkpJwk,
  EcJwk,
  KryptosBuffer,
  KryptosFromJwk,
  OctJwk,
  OkpJwk,
  RsaJwk,
} from "../../../types/index.js";
import { createAkpDerFromJwk } from "../akp/der-from-jwk.js";
import { createEcDerFromJwk } from "../ec/der-from-jwk.js";
import { createOctDerFromJwk } from "../oct/der-from-jwk.js";
import { createOkpDerFromJwk } from "../okp/der-from-jwk.js";
import { createRsaDerFromJwk } from "../rsa/der-from-jwk.js";

// The `id` is intentionally omitted: `parseJwkOptions` carries `kid` through as
// the id, and when the JWK has no `kid` the Kryptos constructor derives one
// (thumbprint for asymmetric keys, random for oct).
export const createDerFromJwk = (options: KryptosFromJwk): Omit<KryptosBuffer, "id"> => {
  switch (options.kty) {
    case "AKP":
      return {
        ...createAkpDerFromJwk(options as AkpJwk),
        algorithm: options.alg,
        type: options.kty,
        use: options.use,
      };

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
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The JWK key type '${options.kty as string}' is not supported for import.`,
        data: { kty: options.kty },
      });
  }
};
