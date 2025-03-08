import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { EcDer, KryptosFromBuffer } from "../../../types";
import { isEcCurve } from "./is-ec-curve";

type Options = Omit<KryptosFromBuffer, "algorithm" | "type" | "use">;

type Result = Omit<EcDer, "algorithm" | "type" | "use">;

export const createEcDerFromDer = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required");
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
      throw new KryptosError("Key creation failed");
    }
    if (!isBuffer(publicKey)) {
      throw new KryptosError("Key creation failed");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey?.length) {
    const publicObject = createPublicKey({ key: options.publicKey, format: "der" });
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
