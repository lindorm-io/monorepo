import type { Dict } from "@lindorm/types";
import type { IAmphora } from "@lindorm/amphora";
import { AesKit } from "@lindorm/aes";
import { ProteusError } from "../../../errors/index.js";

export const encryptFieldValue = (
  value: unknown,
  predicate: Dict | null,
  amphora: IAmphora,
  fieldKey = "unknown",
  entityName = "unknown",
): string => {
  if (!amphora) {
    throw new ProteusError(
      "Encryption requires an amphora instance but none was provided",
      {
        code: "missing_amphora",
        title: "Missing Amphora",
        details:
          "Encrypting an @Encrypted field requires an amphora instance; pass amphora to the ProteusSource options.",
      },
    );
  }

  try {
    // A field-encryption key is a KEK: it never leaves the service and never
    // belongs in a JWKS, so it is an internal (`publish: false`) key — and
    // amphora excludes internal keys from selection unless asked. This is a
    // default, not a floor: the caller's predicate still wins, as everywhere
    // else. Decryption needs no equivalent — it resolves the exact key by id
    // from the ciphertext, and `findByIdSync` is deliberately unfiltered.
    const key = amphora.findSync({ publish: false, ...predicate, use: "enc" });
    const kit = new AesKit({ kryptos: key });
    return kit.encrypt(value as any, "encoded");
  } catch (error) {
    throw new ProteusError(
      `Failed to encrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "encrypt_failed",
        title: "Encrypt Failed",
        details: `Could not encrypt field "${fieldKey}" on entity "${entityName}"; the amphora may not have an encryption key matching the required predicate.`,
        data: { field: fieldKey, entity: entityName },
        error: error as Error,
      },
    );
  }
};
