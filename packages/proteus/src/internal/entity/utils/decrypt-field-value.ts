import type { IAmphora } from "@lindorm/amphora";
import { AesKit } from "@lindorm/aes";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";
import { resolveDecryptionKey } from "./resolve-decryption-key.js";

export const decryptFieldValue = (
  cipher: string,
  encrypted: MetaEncrypted,
  amphora: IAmphora,
  fieldKey = "unknown",
  entityName = "unknown",
): unknown => {
  if (!amphora) {
    throw new ProteusError(
      "Encryption requires an amphora instance but none was provided",
      {
        code: "missing_amphora",
        title: "Missing Amphora",
        details:
          "Decrypting an @Encrypted field requires an amphora instance; pass amphora to the ProteusSource options.",
      },
    );
  }

  // Resolved OUTSIDE the try: a key that cannot be found, or that violates the
  // decryption floor, is a policy failure with its own error — not a cipher
  // failure to be wrapped as one.
  const key = resolveDecryptionKey(cipher, encrypted, amphora, fieldKey, entityName);

  try {
    const kit = new AesKit({ kryptos: key });
    return kit.decrypt(cipher);
  } catch (error) {
    throw new ProteusError(
      `Failed to decrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "decrypt_failed",
        title: "Decrypt Failed",
        details: `Could not decrypt field "${fieldKey}" on entity "${entityName}"; the ciphertext may be malformed or was not sealed by the key it names.`,
        data: { entity: entityName, field: fieldKey, kid: key.id },
        error: error as Error,
      },
    );
  }
};
