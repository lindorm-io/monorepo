import type { AmphoraPredicate, IAmphora } from "@lindorm/amphora";
import type { IKryptos } from "@lindorm/kryptos";
import { Predicated } from "@lindorm/utils";
import { IrisEncryptionError } from "../../../errors/IrisEncryptionError.js";
import type { IrisEncryptionKey } from "../../../types/encryption.js";
import { ENCRYPTION_DEFAULT, ENCRYPTION_FLOOR } from "../../constants/key-floor.js";
import { hasEncryptionKey } from "./has-encryption-key.js";

export type ResolveEncryptionKeyOptions = {
  amphora: IAmphora;

  /** The effective descriptor: the message's `@Encrypted` over the source default. */
  key: IrisEncryptionKey;

  /**
   * The `kid` an encrypted payload names. Resolved with `findById`, which is
   * deliberately UNFILTERED: a message encrypted with a since-rotated key must
   * still decrypt. The FLOOR is what keeps that safe — the payload names the
   * key, so without it a payload could name the key that decrypts it.
   */
  id?: string;
};

/**
 * Resolve the key for one message-encryption operation, keeping the two jobs a
 * predicate can do strictly apart (only one of them survives key injection):
 *
 *   FLOOR    — policy. Checked on the key, whatever its provenance.
 *   SELECTOR — a vault query. Checked on nothing; it only ever selects.
 *
 * There is no fallback: a key either satisfies the policy or it does not, and a
 * miss is a throw. Falling back to a key the policy forbids is how a signing key
 * ends up wrapping a payload.
 */
export const resolveEncryptionKey = async (
  options: ResolveEncryptionKeyOptions,
): Promise<IKryptos> => {
  const { amphora, id, key } = options;

  if (!hasEncryptionKey(key)) {
    throw new IrisEncryptionError("@Encrypted names no encryption key", {
      code: "missing_encryption_key",
      title: "Missing Encryption Key",
      details:
        "A message marked with @Encrypted must name its key — either a kryptos or a predicate, on the decorator or as the source-level encryption default. An unscoped lookup would select whatever key happens to be newest.",
    });
  }

  // The selector applies to the vault query alone. An injected key and a key
  // named by an encrypted payload both come from outside it.
  const query: AmphoraPredicate = {
    ...ENCRYPTION_FLOOR,
    ...ENCRYPTION_DEFAULT,
    ...key.predicate,
  };

  const kryptos = id
    ? // An injected key is typically an env KEK that was never added to the
      // vault. It encrypted this payload, so it must be consulted to decrypt it
      // — but only when the payload names it, never as a blanket override.
      ((key.kryptos?.id === id ? key.kryptos : undefined) ??
      (await amphora.findById(id).catch((error: Error) => {
        throw new IrisEncryptionError("Encryption key not found", {
          code: "encryption_key_not_found",
          title: "Encryption Key Not Found",
          details:
            "The key referenced by the encrypted payload is neither in the Amphora nor the key injected on @Encrypted. Ensure the key that encrypted the message is available to the consumer.",
          data: { kid: id },
          debug: { error: error.message },
        });
      })))
    : (key.kryptos ??
      (await amphora.find(query).catch((error: Error) => {
        throw new IrisEncryptionError("Encryption key not found", {
          code: "encryption_key_not_found",
          title: "Encryption Key Not Found",
          details:
            "No key in the Amphora satisfies the encryption policy for this message. Add a matching encryption key, or widen the @Encrypted predicate.",
          data: { policy: query },
          debug: { error: error.message },
        });
      })));

  // The FLOOR applies to the selected key, the pinned key AND the injected key.
  if (!Predicated.match(kryptos, ENCRYPTION_FLOOR)) {
    throw new IrisEncryptionError("Encryption key violates the iris key floor", {
      code: "encryption_key_policy_violation",
      title: "Encryption Key Policy Violation",
      details:
        "The resolved key cannot be used for message encryption. A message key must be an encryption key (use: enc) and must hold a private half, so that what it encrypts it can also decrypt.",
      data: {
        kid: kryptos.id,
        algorithm: kryptos.algorithm,
        use: kryptos.use,
        floor: ENCRYPTION_FLOOR,
      },
      debug: { kryptos: kryptos.toJSON() },
    });
  }

  return kryptos;
};
