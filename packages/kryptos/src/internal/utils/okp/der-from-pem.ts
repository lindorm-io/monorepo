import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromString, OkpBuffer } from "../../../types/index.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createOkpDerFromPem = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Invalid OKP curve", {
      code: "invalid_okp_curve",
      title: "Invalid OKP Curve",
      details:
        "A valid OKP curve (Ed25519, Ed448, X25519, or X448) must be provided to build DER from a PEM key.",
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
      format: "pem",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details:
          "The private key DER export from the PEM input did not return a Buffer as expected.",
        data: { component: "privateKey", format: "der" },
      });
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey) {
    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "pem",
      type: "spki",
    });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details:
          "The public key DER export from the PEM input did not return a Buffer as expected.",
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
        "Neither a private nor a public key was supplied as PEM, so no OKP DER key could be created.",
      data: { curve: options.curve },
    });
  }

  return result;
};
