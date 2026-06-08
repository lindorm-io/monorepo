import { isString } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { EcString, KryptosBuffer } from "../../../types/index.js";
import { isEcCurve } from "./is-ec-curve.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<EcString, "id" | "algorithm" | "type" | "use">;

export const exportEcToPem = (options: Options): Result => {
  if (!isEcCurve(options.curve)) {
    throw new KryptosError("Curve is required", {
      code: "missing_ec_curve",
    });
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
      throw new KryptosError("Key export failed [private]: expected PEM string", {
        code: "ec_pem_export_failed",
        data: { component: "privateKey", format: "pem" },
      });
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [public]: expected PEM string", {
        code: "ec_pem_export_failed",
        data: { component: "publicKey", format: "pem" },
      });
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
      throw new KryptosError("Key export failed [public]: expected PEM string", {
        code: "ec_pem_export_failed",
        data: { component: "publicKey", format: "pem" },
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey.length) {
    throw new KryptosError("Key export failed: no public key available", {
      code: "missing_ec_public_key",
    });
  }

  return result;
};
