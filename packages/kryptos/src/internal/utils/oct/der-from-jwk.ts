import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromJwk, OctBuffer } from "../../../types/index.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<OctBuffer, "id" | "algorithm" | "type" | "use">;

export const createOctDerFromJwk = (options: Options): Result => {
  if (options.kty !== "oct") {
    throw new KryptosError("Invalid key type", {
      code: "unsupported_key_type",
      data: { kty: options.kty },
    });
  }
  if (!options.k) {
    throw new KryptosError("Invalid key", {
      code: "missing_oct_private_key",
    });
  }

  return { privateKey: Buffer.from(options.k, "base64url") };
};
