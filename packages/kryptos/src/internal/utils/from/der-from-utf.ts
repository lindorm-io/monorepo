import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromString } from "../../../types/index.js";
import { validateOctSecret } from "../oct/validate-secret.js";

const allocate = (options: KryptosFromString): Buffer => {
  if (!options.privateKey) {
    throw new KryptosError("Missing private key", {
      code: "missing_oct_private_key",
      title: "Missing Oct Private Key",
      details: "No oct private key string was provided to allocate the key buffer.",
    });
  }

  const secret = Buffer.from(options.privateKey, "utf8");

  validateOctSecret(options, secret);

  return secret;
};

// The `id` is intentionally omitted: `parseStdOptions` carries an explicit id
// through, and absent one the Kryptos constructor derives it (oct: random).
export const createDerFromUtf = (
  options: KryptosFromString,
): Omit<KryptosBuffer, "id"> => {
  switch (options.type) {
    case "oct":
      return {
        algorithm: options.algorithm,
        privateKey: allocate(options),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type}' is not supported for UTF-8 import; only 'oct' is allowed.`,
        data: { type: options.type },
      });
  }
};
