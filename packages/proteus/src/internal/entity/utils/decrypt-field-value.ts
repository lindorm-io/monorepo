import type { IAmphora } from "@lindorm/amphora";
import { AesKit, parseAes } from "@lindorm/aes";
import { ProteusError } from "../../../errors/index.js";

export const decryptFieldValue = (
  cipher: string,
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

  try {
    const { keyId } = parseAes(cipher);
    const key = amphora.findByIdSync(keyId);
    const kit = new AesKit({ kryptos: key });
    return kit.decrypt(cipher);
  } catch (error) {
    throw new ProteusError(
      `Failed to decrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "decrypt_failed",
        title: "Decrypt Failed",
        details: `Could not decrypt field "${fieldKey}" on entity "${entityName}"; the decryption key may be missing from the amphora or the ciphertext may be malformed.`,
        data: { field: fieldKey, entity: entityName },
        error: error as Error,
      },
    );
  }
};
