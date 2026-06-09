import { isString } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosBuffer, OkpString } from "../../../types/index.js";
import { isOkpCurve } from "./is-okp-curve.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<OkpString, "id" | "algorithm" | "type" | "use">;

export const exportOkpToPem = (options: Options): Result => {
  if (!isOkpCurve(options.curve)) {
    throw new KryptosError("Invalid OKP curve", {
      code: "invalid_okp_curve",
      title: "Invalid OKP Curve",
      details:
        "A valid OKP curve (Ed25519, Ed448, X25519, or X448) must be provided to export the key to PEM.",
      data: { curve: options.curve ?? null },
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
      throw new KryptosError("OKP PEM export failed: expected private key string", {
        code: "okp_pem_export_failed",
        title: "OKP PEM Export Failed",
        details: "The private key PEM export did not return a string as expected.",
        data: { curve: options.curve, key: "private" },
      });
    }
    if (!isString(publicKey)) {
      throw new KryptosError("OKP PEM export failed: expected public key string", {
        code: "okp_pem_export_failed",
        title: "OKP PEM Export Failed",
        details: "The public key PEM export did not return a string as expected.",
        data: { curve: options.curve, key: "public" },
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
      throw new KryptosError("OKP PEM export failed: expected public key string", {
        code: "okp_pem_export_failed",
        title: "OKP PEM Export Failed",
        details: "The public key PEM export did not return a string as expected.",
        data: { curve: options.curve, key: "public" },
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey.length) {
    throw new KryptosError("Key export failed: no public key available", {
      code: "missing_okp_public_key",
      title: "Missing OKP Public Key",
      details:
        "No public key could be derived or supplied, so the OKP key cannot be exported to PEM.",
    });
  }

  return result;
};
