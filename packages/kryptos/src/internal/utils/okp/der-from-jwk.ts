import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosFromJwk, OkpBuffer } from "../../../types/index.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosFromJwk, "kid" | "alg" | "use">;

type Result = Omit<OkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createOkpDerFromJwk = (options: Options): Result => {
  if (!isOkpCurve(options.crv)) {
    throw new KryptosError("Invalid OKP curve", {
      code: "invalid_okp_curve",
      title: "Invalid OKP Curve",
      details:
        "The JWK crv must be a valid OKP curve (Ed25519, Ed448, X25519, or X448) to build DER from the JWK.",
      data: { curve: options.crv ?? null },
    });
  }

  const result: Result = {
    curve: options.crv,
    publicKey: Buffer.alloc(0),
  };

  if (options.d && options.x) {
    const privateObject = createPrivateKey({
      key: options,
      format: "jwk",
      type: "pkcs8",
    });
    const privateKey = privateObject.export({ format: "der", type: "pkcs8" });

    if (!isBuffer(privateKey)) {
      throw new KryptosError("Key creation failed", {
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details:
          "The private key DER export from the JWK (d, x) did not return a Buffer as expected.",
        data: { component: "privateKey", format: "der" },
      });
    }

    result.privateKey = privateKey;
  }

  if (options.x) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed", {
        code: "okp_key_creation_failed",
        title: "OKP Key Creation Failed",
        details:
          "The public key DER export from the JWK (x) did not return a Buffer as expected.",
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
        "The JWK lacked the components needed to build either a private or public OKP DER key.",
      data: { curve: options.crv },
    });
  }

  return result;
};
