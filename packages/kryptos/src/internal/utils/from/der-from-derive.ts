import { hkdfSync } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, KryptosFromDerive } from "../../../types/index.js";
import { getOctSize } from "../oct/get-size.js";

const derive = (options: KryptosFromDerive): Buffer => {
  if (!options.deriveFrom) {
    throw new KryptosError("Missing passphrase", {
      code: "missing_oct_passphrase",
      title: "Missing Oct Passphrase",
      details: "No passphrase string was provided to derive the oct key.",
    });
  }

  const size = getOctSize(options);

  const derived = hkdfSync(
    "sha256",
    Buffer.from(options.deriveFrom, "utf8"),
    Buffer.alloc(0),
    Buffer.from("lindorm:oct:" + options.algorithm),
    size,
  );

  return Buffer.from(derived);
};

export const createDerFromDerive = (options: KryptosFromDerive): KryptosBuffer => {
  switch (options.type) {
    case "oct":
      return {
        id: options.id,
        algorithm: options.algorithm,
        privateKey: derive(options),
        publicKey: Buffer.alloc(0),
        type: options.type,
        use: options.use,
      };

    default:
      throw new KryptosError("Invalid key type", {
        code: "unsupported_key_type",
        title: "Unsupported Key Type",
        details: `The key type '${options.type}' is not supported for derive import; only 'oct' is allowed.`,
        data: { type: options.type },
      });
  }
};
