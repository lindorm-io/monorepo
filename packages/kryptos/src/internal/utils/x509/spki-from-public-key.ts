import { createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosType } from "../../../types/index.js";

export const spkiFromPublicKey = (publicKey: Buffer, type: KryptosType): Buffer => {
  if (type === "oct") {
    throw new KryptosError("Symmetric keys have no SubjectPublicKeyInfo", {
      code: "unsupported_key_type",
      title: "Unsupported Key Type",
      details:
        "A symmetric ('oct') key was supplied, but SubjectPublicKeyInfo can only be derived from an asymmetric public key.",
      data: { type },
    });
  }

  const sourceType = type === "RSA" ? "pkcs1" : "spki";
  const keyObject = createPublicKey({ key: publicKey, format: "der", type: sourceType });
  const out = keyObject.export({ format: "der", type: "spki" });

  if (!Buffer.isBuffer(out)) {
    throw new KryptosError("Failed to export kryptos public key as SPKI DER", {
      code: "spki_export_failed",
      title: "SPKI Export Failed",
      details: `Exporting the '${type}' public key as SPKI DER did not return a Buffer.`,
      data: { type },
    });
  }

  return out;
};
