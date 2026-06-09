import { isBuffer } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { AkpBuffer, KryptosFromString } from "../../../types/index.js";

type Options = Omit<KryptosFromString, "id" | "algorithm" | "type" | "use">;

type Result = Omit<AkpBuffer, "id" | "algorithm" | "type" | "use">;

export const createAkpDerFromPem = (options: Options): Result => {
  const result: Result = {
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
        code: "akp_der_export_failed",
        title: "AKP DER Export Failed",
        details:
          "Exporting the private key from PEM to PKCS8 DER did not return a Buffer.",
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
        code: "akp_der_export_failed",
        title: "AKP DER Export Failed",
        details: "Exporting the public key from PEM to SPKI DER did not return a Buffer.",
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.privateKey && !result.publicKey.length) {
    throw new KryptosError("Key creation failed", {
      code: "missing_akp_key_material",
      title: "Missing AKP Key Material",
      details: "Neither a private key nor a public key was provided in PEM form.",
    });
  }

  return result;
};
