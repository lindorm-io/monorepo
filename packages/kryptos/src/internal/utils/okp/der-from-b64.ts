import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromString, OkpBuffer } from "../../../types/index.js";
import { createOkpDerFromDer } from "./der-from-der.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createOkpDerFromB64 = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Curve is required");
  }

  const result: Result = {
    curve: options.curve,
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey && !options.publicKey) {
    const der = createOkpDerFromDer({
      curve: options.curve,
      privateKey: Buffer.from(options.privateKey, "base64url"),
      publicKey: Buffer.alloc(0),
    });

    result.privateKey = der.privateKey;
    result.publicKey = der.publicKey;
  }

  if (!result.privateKey && options.privateKey) {
    result.privateKey = Buffer.from(options.privateKey, "base64url");
  }

  if (!result.publicKey.length && options.publicKey) {
    result.publicKey = Buffer.from(options.publicKey, "base64url");
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};
