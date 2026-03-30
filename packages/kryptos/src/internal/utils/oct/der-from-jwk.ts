import { KryptosError } from "../../../errors";
import { KryptosFromJwk, OctBuffer } from "../../../types";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<OctBuffer, "id" | "algorithm" | "type" | "use">;

export const createOctDerFromJwk = (options: Options): Result => {
  if (options.kty !== "oct") {
    throw new KryptosError("Invalid key type");
  }
  if (!options.k) {
    throw new KryptosError("Invalid key");
  }

  return { privateKey: Buffer.from(options.k, "base64url") };
};
