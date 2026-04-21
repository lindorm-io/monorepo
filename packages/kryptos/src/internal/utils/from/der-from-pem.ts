import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromString } from "../../../types/index.js";
import { createAkpDerFromPem } from "../akp/der-from-pem.js";
import { createEcDerFromPem } from "../ec/der-from-pem.js";
import { createOctDerFromPem } from "../oct/der-from-pem.js";
import { createOkpDerFromPem } from "../okp/der-from-pem.js";
import { createRsaDerFromPem } from "../rsa/der-from-pem.js";

export const createDerFromPem = (options: KryptosFromString): KryptosBuffer => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "EC":
      return {
        ...createEcDerFromPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "oct":
      return {
        ...createOctDerFromPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "OKP":
      return {
        ...createOkpDerFromPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    case "RSA":
      return {
        ...createRsaDerFromPem(options),
        id: options.id,
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

    default:
      throw new KryptosError("Invalid key type");
  }
};
