import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { EcBuffer, KryptosFromJwk } from "../../../types/index.js";
import { isEcCurve } from "./is-ec-curve.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<EcBuffer, "id" | "algorithm" | "type" | "use">;

export const createEcDerFromJwk = (options: Options): Result => {
  if (!isEcCurve(options.crv)) {
    throw new KryptosError("Curve is required", {
      code: "missing_ec_curve",
      title: "Missing EC Curve",
      details:
        "The JWK crv must be a valid EC curve (P-256, P-384, or P-521) to build DER from the JWK.",
    });
  }

  const result: Result = {
    curve: options.crv,
    publicKey: Buffer.alloc(0),
  };

  if (options.d && options.x && options.y) {
    const privateObject = createPrivateKey({
      key: options,
      format: "jwk",
      type: "pkcs8",
    });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "ec_key_creation_failed",
        title: "EC Key Creation Failed",
        details:
          "The private key DER export from the JWK (d, x, y) did not return a Buffer as expected.",
        data: { component: "privateKey", format: "der" },
      });
    }

    result.privateKey = privateKey;
  }

  if (options.x && options.y) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "ec_key_creation_failed",
        title: "EC Key Creation Failed",
        details:
          "The public key DER export from the JWK (x, y) did not return a Buffer as expected.",
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
        "The JWK lacked the components needed to build either a private or public EC DER key.",
      data: { curve: options.crv },
    });
  }

  return result;
};
