import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromBuffer, OkpBuffer } from "../../../types/index.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosFromBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createOkpDerFromDer = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Invalid OKP curve", {
      code: "invalid_okp_curve",
      title: "Invalid OKP Curve",
      details:
        "A valid OKP curve (Ed25519, Ed448, X25519, or X448) must be provided to normalize DER key material.",
      data: { curve: options.curve ?? null },
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
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details: "The private key DER re-export did not return a Buffer as expected.",
        data: { component: "privateKey", format: "der" },
      });
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey?.length) {
    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details: "The public key DER re-export did not return a Buffer as expected.",
        data: { component: "publicKey", format: "der" },
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed", {
      code: "okp_key_creation_failed",
      title: "OKP Key Creation Failed",
      details:
        "Neither a private nor a public key DER buffer was supplied, so no OKP key could be created.",
      data: { curve: options.curve },
    });
  }

  return result;
};
