import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromString } from "../../../types/index.js";
import { createAkpDerFromB64 } from "../akp/der-from-b64.js";
import { createEcDerFromB64 } from "../ec/der-from-b64.js";
import { createOkpDerFromB64 } from "../okp/der-from-b64.js";
import { createRsaDerFromB64 } from "../rsa/der-from-b64.js";

// The `id` is intentionally omitted: `parseStdOptions` carries an explicit id
// through, and absent one the Kryptos constructor derives it from the key
// material (thumbprint for asymmetric keys, random for oct).
export const createDerFromB64 = (
  options: KryptosFromString,
): Omit<KryptosBuffer, "id"> => {
  switch (options.type) {
    case "AKP":
      return {
        ...createAkpDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "EC":
      return {
        ...createEcDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "oct":
      return {
        algorithm: options.algorithm,
        privateKey: options.privateKey
          ? Buffer.from(options.privateKey, "base64url")
          : Buffer.alloc(0),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    case "OKP":
      return {
        ...createOkpDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    case "RSA":
      return {
        ...createRsaDerFromB64(options),
        algorithm: options.algorithm,
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type as string}' is not supported for base64url import.`,
        data: { type: options.type },
      });
  }
};
