import type { IAmphora } from "@lindorm/amphora";
import { AesKit, parseAes } from "@lindorm/aes";
import type { IKryptos } from "@lindorm/kryptos";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";

/**
 * Decryption needs no SELECTOR: the ciphertext names its own key. The predicate
 * is therefore irrelevant here, and `findByIdSync` is deliberately unfiltered —
 * a column written by a key that has since been rotated out of the active set
 * must still open.
 *
 * An INJECTED key, though, is not necessarily a vault resident at all: a KEK
 * imported from the environment and handed to `@Encrypted({ kryptos })` may never
 * be added to the amphora. Such a column would encrypt fine and then fail to
 * decrypt forever. So the injected key is consulted FIRST — but only when the
 * ciphertext actually names it, so that rows written before the injection (by a
 * vault key) still resolve through the vault.
 */
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

  try {
    const { keyId } = parseAes(cipher);

    const key: IKryptos =
      encrypted.kryptos?.id === keyId ? encrypted.kryptos : amphora.findByIdSync(keyId);

    const kit = new AesKit({ kryptos: key });
    return kit.decrypt(cipher);
  } catch (error) {
    throw new ProteusError(
      `Failed to decrypt field "${fieldKey}" on entity "${entityName}"`,
      {
        code: "decrypt_failed",
        title: "Decrypt Failed",
        details: `Could not decrypt field "${fieldKey}" on entity "${entityName}"; the decryption key may be missing from the amphora or the ciphertext may be malformed.`,
        data: { entity: entityName, field: fieldKey },
        error: error as Error,
      },
    );
  }
};
