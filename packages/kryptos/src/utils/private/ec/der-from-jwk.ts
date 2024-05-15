import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { EcDer, KryptosJwk } from "../../../types";
import { _isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosJwk, "alg" | "use">;

type Result = Omit<EcDer, "algorithm" | "type" | "use">;

export const _createEcDerFromJwk = (options: Options): Result => {
  if (!_isEcCurve(options.crv)) {
    throw new KryptosError("Curve is required");
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
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
  }

  if (options.x && options.y) {
    const publicObject = createPublicKey({ key: options, format: "jwk" });
    const publicKey = publicObject.export({ format: "der", type: "spki" });

    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed");
  }

  return result;
};
