import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromBuffer } from "../../../types/index.js";
import { createAkpDerFromDer } from "../akp/der-from-der.js";
import { createEcDerFromDer } from "../ec/der-from-der.js";
import { createOkpDerFromDer } from "../okp/der-from-der.js";
import { createRsaDerFromDer } from "../rsa/der-from-der.js";

// The `id` is intentionally omitted: `parseStdOptions` carries an explicit id
// through, and absent one the Kryptos constructor derives it from the key
// material (thumbprint for asymmetric keys, random for oct).
export const createDerFromDer = (
  options: KryptosFromBuffer,
): Omit<KryptosBuffer, "id"> => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "EC":
      return {
        ...createEcDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
        algorithm: options.algorithm,
        privateKey: options.privateKey,
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromDer(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type as string}' is not supported for DER import.`,
        data: { type: options.type },
      });
  }
};
