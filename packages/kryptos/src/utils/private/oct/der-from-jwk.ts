import { KryptosJwk, OctDer } from "../../../types";

type Options = Omit<KryptosJwk, "alg" | "use">;

type Result = Omit<OctDer, "algorithm" | "type" | "use">;

export const _createOctDerFromJwk = (options: Options): Result => ({
  privateKey: options.k ? Buffer.from(options.k, "base64url") : Buffer.alloc(0),
  publicKey: Buffer.alloc(0),
});
