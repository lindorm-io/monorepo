import { KryptosError } from "../../../errors";
import { KryptosJwk, OctDer } from "../../../types";

type Options = Omit<KryptosJwk, "alg" | "use">;

type Result = Omit<OctDer, "algorithm" | "type" | "use">;

export const createOctDerFromJwk = (options: Options): Result => {
  if (options.kty !== "oct") {
    throw new KryptosError("Invalid key type");
  }
  if (!options.k) {
    throw new KryptosError("Invalid key");
  }

  return {
    privateKey: Buffer.from(options.k, "base64url"),
    publicKey: Buffer.alloc(0),
  };
};
