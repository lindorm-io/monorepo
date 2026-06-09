import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromJwk, OctBuffer } from "../../../types/index.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<OctBuffer, "id" | "algorithm" | "type" | "use">;

export const createOctDerFromJwk = (options: Options): Result => {
  if (options.kty !== "oct") {
    throw new KryptosError("Invalid key type", {
      code: "unsupported_key_type",
      title: "Unsupported Key Type",
      details: `Expected a JWK with kty 'oct' but received '${options.kty}'.`,
      data: { kty: options.kty },
    });
  }
  if (!options.k) {
    throw new KryptosError("Invalid key", {
      code: "missing_oct_private_key",
      title: "Missing Oct Private Key",
      details: "The oct JWK is missing the required secret key component 'k'.",
    });
  }

  return { privateKey: Buffer.from(options.k, "base64url") };
};
