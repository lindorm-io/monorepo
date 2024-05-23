import { KryptosError } from "../../../errors";
import { EcDer, KryptosPem } from "../../../types";
import { createEcDerFromDer } from "./der-from-der";
import { isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosPem, "algorithm" | "type" | "use">;

type Result = Omit<EcDer, "algorithm" | "type" | "use">;

export const createEcDerFromB64 = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required");
  }

  const result: Result = {
    curve: options.curve,
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey && !options.publicKey) {
    const der = createEcDerFromDer({
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
