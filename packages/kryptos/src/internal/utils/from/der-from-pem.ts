import { KryptosError } from "../../../errors";
import { KryptosBuffer, KryptosFromString } from "../../../types";
import { createEcDerFromPem } from "../ec/der-from-pem";
import { createOctDerFromPem } from "../oct/der-from-pem";
import { createOkpDerFromPem } from "../okp/der-from-pem";
import { createRsaDerFromPem } from "../rsa/der-from-pem";

export const createDerFromPem = (options: KryptosFromString): KryptosBuffer => {
  switch (options.type) {
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
