import type { IAmphora } from "@lindorm/amphora";
import { AesKit } from "@lindorm/aes";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { resolveEncryptionKey } from "./resolve-encryption-key.js";

export const encryptFieldValue = (
  value: unknown,
  encrypted: MetaEncrypted,
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

  // Resolved OUTSIDE the try: a key that cannot be found, or that violates the
  // encryption floor, is a policy failure with its own error — not a cipher
  // failure to be wrapped as one.
  const key = resolveEncryptionKey(encrypted, amphora, fieldKey, entityName);

  try {
    const kit = new AesKit({ kryptos: key });
    return kit.encrypt(value as any);
  } catch (error) {
    throw new ProteusError(
      `Failed to encrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "encrypt_failed",
        title: "Encrypt Failed",
        details: `Could not encrypt field "${fieldKey}" on entity "${entityName}" with key "${key.id}"; the value may not be a supported type.`,
        data: { entity: entityName, field: fieldKey, kid: key.id },
        error: error as Error,
      },
    );
  }
};
