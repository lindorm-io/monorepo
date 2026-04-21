import { createPublicKey } from "crypto";
import { KryptosError } from "../../../errors/index.js";
import type { KryptosType } from "../../../types/index.js";

export const spkiFromPublicKey = (publicKey: Buffer, type: KryptosType): Buffer => {
  if (type === "oct") {
    throw new KryptosError("Symmetric keys have no SubjectPublicKeyInfo");
  }

  const sourceType = type === "RSA" ? "pkcs1" : "spki";
  const keyObject = createPublicKey({ key: publicKey, format: "der", type: sourceType });
  const out = keyObject.export({ format: "der", type: "spki" });

  if (!Buffer.isBuffer(out)) {
    throw new KryptosError("Failed to export kryptos public key as SPKI DER");
  }

  return out;
};
