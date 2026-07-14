import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromString } from "../../../types/index.js";
import { createAkpDerFromPem } from "../akp/der-from-pem.js";
import { createEcDerFromPem } from "../ec/der-from-pem.js";
import { createOctDerFromPem } from "../oct/der-from-pem.js";
import { createOkpDerFromPem } from "../okp/der-from-pem.js";
import { createRsaDerFromPem } from "../rsa/der-from-pem.js";

// The `id` is intentionally omitted: `parseStdOptions` carries an explicit id
// through, and absent one the Kryptos constructor derives it from the key
// material (thumbprint for asymmetric keys, random for oct).
export const createDerFromPem = (
  options: KryptosFromString,
): Omit<KryptosBuffer, "id"> => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromPem(options),
        algorithm: options.algorithm,
        use: options.use,
        type: options.type,
      };

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
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type as string}' is not supported for PEM import.`,
        data: { type: options.type },
      });
  }
};
