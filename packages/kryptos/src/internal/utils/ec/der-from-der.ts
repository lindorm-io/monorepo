import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { EcBuffer, KryptosFromBuffer } from "../../../types/index.js";
import { isEcCurve } from "./is-ec-curve.js";

type Options = Omit<KryptosFromBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<EcBuffer, "id" | "algorithm" | "type" | "use">;

export const createEcDerFromDer = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required", {
      code: "missing_ec_curve",
      title: "Missing EC Curve",
      details:
        "A valid EC curve (P-256, P-384, or P-521) must be provided to normalize DER key material.",
    });
  }

  const result: Result = {
    curve: options.curve,
    publicKey: Buffer.alloc(0),
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "ec_key_creation_failed",
        title: "EC Key Creation Failed",
        details: "The private key DER re-export did not return a Buffer as expected.",
        data: { component: "privateKey", format: "der" },
      });
    }
    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "ec_key_creation_failed",
        title: "EC Key Creation Failed",
        details: "The public key DER re-export did not return a Buffer as expected.",
        data: { component: "publicKey", format: "der" },
      });
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey?.length) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "der" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "ec_key_creation_failed",
        title: "EC Key Creation Failed",
        details: "The public key DER re-export did not return a Buffer as expected.",
        data: { component: "publicKey", format: "der" },
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed", {
      code: "ec_key_creation_failed",
      title: "EC Key Creation Failed",
      details:
        "Neither a private nor a public key DER buffer was supplied, so no EC key could be created.",
      data: { curve: options.curve },
    });
  }

  return result;
};
