import { Matcher } from "@lindorm/match";
import { DECRYPT_FLOOR, type IAmphora } from "@lindorm/amphora";
import { parseAes } from "@lindorm/aes";
import type { IKryptos } from "@lindorm/kryptos";
import { ProteusError } from "../../../errors/index.js";
import type { MetaEncrypted } from "../types/metadata.js";

/**
 * Resolve the key that opens one `@Encrypted` field.
 *
 * Decryption needs no SELECTOR: the ciphertext names its own key. The predicate
 * is therefore irrelevant here, and `findByIdSync` is deliberately unfiltered —
 * a column written by a key that has since been rotated out of the active set
 * must still open.
 *
 * That is exactly why the FLOOR is not optional on this side. The `kid` is
 * chosen by whoever wrote the row, so an unfloored `findByIdSync` lets the
 * ciphertext pick which key in the vault answers for it — including a signing
 * key, or a key whose `notBefore` has not yet passed and which therefore cannot
 * have encrypted anything. The floor is the only check between the ciphertext's
 * claim and the crypto layer.
 *
 * An INJECTED key, though, is not necessarily a vault resident at all: a KEK
 * imported from the environment and handed to `@Encrypted({ kryptos })` may never
 * be added to the amphora. Such a column would encrypt fine and then fail to
 * decrypt forever. So the injected key is consulted FIRST — but only when the
 * ciphertext actually names it, so that rows written before the injection (by a
 * vault key) still resolve through the vault.
 */
export const resolveDecryptionKey = (
  cipher: string,
  encrypted: MetaEncrypted,
  amphora: IAmphora,
  fieldKey: string,
  entityName: string,
): IKryptos => {
  let kryptos: IKryptos;

  try {
    const { keyId } = parseAes(cipher);

    kryptos =
      encrypted.kryptos?.id === keyId ? encrypted.kryptos : amphora.findByIdSync(keyId);
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

  if (!Matcher.match(kryptos, DECRYPT_FLOOR)) {
    throw new ProteusError(
      `Decryption key for field "${fieldKey}" on entity "${entityName}" violates the decryption floor`,
      {
        code: "decryption_key_policy_violation",
        title: "Decryption Key Policy Violation",
        details: `The key named by the ciphertext of field "${fieldKey}" on entity "${entityName}" cannot decrypt at rest: it must have use "enc" and a private half, and it must not be pending — a key whose notBefore has not yet passed cannot have encrypted this value. An EXPIRED key is accepted, and must be: a column encrypted before a rotation has to keep opening afterwards.`,
        data: {
          entity: entityName,
          field: fieldKey,
          kid: kryptos.id,
          use: kryptos.use,
          hasPrivateKey: kryptos.hasPrivateKey,
          isPending: kryptos.isPending,
          floor: DECRYPT_FLOOR,
        },
        debug: { kryptos: kryptos.toJSON() },
      },
    );
  }

  return kryptos;
};
