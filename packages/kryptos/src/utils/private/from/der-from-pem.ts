import { KryptosError } from "../../../errors";
import { KryptosDer, KryptosPem } from "../../../types";
import { createEcDerFromPem } from "../ec/der-from-pem";
import { createOctDerFromPem } from "../oct/der-from-pem";
import { createOkpDerFromPem } from "../okp/der-from-pem";
import { createRsaDerFromPem } from "../rsa/der-from-pem";

export const createDerFromPem = (options: KryptosPem): KryptosDer => {
  switch (options.type) {
    case "EC":
      return {
        ...createEcDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "oct":
      return {
        ...createOctDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "OKP":
      return {
        ...createOkpDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "RSA":
      return {
        ...createRsaDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
