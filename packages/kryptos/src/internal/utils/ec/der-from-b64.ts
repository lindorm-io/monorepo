import { KryptosError } from "../../../errors/index.js";
import type { EcBuffer, KryptosFromString } from "../../../types/index.js";
import { createEcDerFromDer } from "./der-from-der.js";
import { isEcCurve } from "./is-ec-curve.js";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<EcBuffer, "id" | "algorithm" | "type" | "use">;

export const createEcDerFromB64 = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required", {
      code: "missing_ec_curve",
      title: "Missing EC Curve",
      details:
        "A valid EC curve (P-256, P-384, or P-521) must be provided to build DER from base64url key material.",
    });
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
    throw new KryptosError("Key creation failed", {
      code: "ec_key_creation_failed",
      title: "EC Key Creation Failed",
      details:
        "Neither a private nor a public key was supplied as base64url, so no EC DER key could be created.",
      data: { curve: options.curve },
    });
  }

  return result;
};
