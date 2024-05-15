import { isString } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosDer, OkpPem } from "../../../types";
import { _isOkpCurve } from "./is-okp-curve";

type Options = Omit<KryptosDer, "algorithm" | "type" | "use">;

type Result = Omit<OkpPem, "algorithm" | "type" | "use">;

export const _exportOkpToPem = (options: Options): Result => {
  if (!_isOkpCurve(options.curve)) {
    throw new KryptosError("Curve is required");
  }

  const result: Result = {
    curve: options.curve,
    publicKey: "",
  };

  if (options.privateKey) {
    const privateObject = createPrivateKey({
      key: options.privateKey,
      format: "der",
      type: "pkcs8",
    });
    const publicObject = createPublicKey(privateObject);

    const privateKey = privateObject.export({ format: "pem", type: "pkcs8" });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (!isString(privateKey)) {
      throw new KryptosError("Key export failed [ private ]");
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.privateKey = privateKey;
    result.publicKey = publicKey;
  }

  if (!result.publicKey.length && options.publicKey) {
    const publicObject = createPublicKey({
      key: options.publicKey,
      format: "der",
      type: "spki",
    });
    const publicKey = publicObject.export({ format: "pem", type: "spki" });

    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [ public ]");
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey.length) {
    throw new KryptosError("Key export failed ");
  }

  return result;
};
