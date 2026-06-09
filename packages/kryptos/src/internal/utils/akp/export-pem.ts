import { isString } from "@lindorm/is";
import { createPrivateKey, createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { AkpString, KryptosBuffer } from "../../../types/index.js";

type Options = Omit<KryptosBuffer, "id" | "algorithm" | "type" | "use">;

type Result = Omit<AkpString, "id" | "algorithm" | "type" | "use">;

export const exportAkpToPem = (options: Options): Result => {
  const result: Result = {
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
        code: "akp_pem_export_failed",
        title: "AKP PEM Export Failed",
        details: "Exporting the private key to PKCS8 PEM did not return a string.",
      });
    }
    if (!isString(publicKey)) {
      throw new KryptosError("Key export failed [public]: expected PEM string", {
        code: "akp_pem_export_failed",
        title: "AKP PEM Export Failed",
        details: "Exporting the public key to SPKI PEM did not return a string.",
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
        code: "akp_pem_export_failed",
        title: "AKP PEM Export Failed",
        details: "Exporting the public key to SPKI PEM did not return a string.",
      });
    }

    result.publicKey = publicKey;
  }

  if (!result.publicKey.length) {
    throw new KryptosError("Key export failed: no public key available", {
      code: "missing_akp_key_material",
      title: "Missing AKP Key Material",
      details: "No public key was available to export to PEM.",
    });
  }

  return result;
};
