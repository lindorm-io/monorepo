import { createPublicKey } from "crypto";
import { KryptosError } from "../../../errors";
import { KryptosType } from "../../../types";

export const spkiFromPublicKey = (publicKey: Buffer, type: KryptosType): Buffer => {
  if (type === "oct") {
    throw new KryptosError("Symmetric keys have no SubjectPublicKeyInfo");
  }

  if (type === "AKP") {
    throw new KryptosError("AKP keys do not yet support certificates");
  }

  const sourceType = type === "RSA" ? "pkcs1" : "spki";
  const keyObject = createPublicKey({ key: publicKey, format: "der", type: sourceType });
  const out = keyObject.export({ format: "der", type: "spki" });

  if (!Buffer.isBuffer(out)) {
    throw new KryptosError("Failed to export kryptos public key as SPKI DER");
  }

  return out;
};
