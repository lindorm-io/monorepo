import { isEmpty, isUndefined } from "@lindorm/is";
import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";
import type { ProteusEncryptionKey } from "../types/encryption.js";

/**
 * Encrypt this field at rest with an amphora-held key.
 *
 * The key is NAMED, never guessed: either handed over outright
 * (`@Encrypted({ kryptos: KEK })` — a KEK is typically an env key, so it is
 * available at class-definition time) or queried for
 * (`@Encrypted({ predicate: { purpose: "pylon:kek" } })`). Leave the decorator
 * bare and the source-level `encryption` default supplies it — declare the KEK
 * once on the source and every `@Encrypted()` field follows it.
 *
 * A field that resolves to NEITHER throws when the source loads: an unscoped
 * lookup would take "any internal encryption key, newest first", and in a vault
 * that also holds a yearly-rotated cookie key that is the cookie key.
 */
export const Encrypted =
  (options?: ProteusEncryptionKey) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Encrypted",
      encrypted: {
        kryptos: isUndefined(options?.kryptos) ? null : options.kryptos,
        // An EMPTY predicate is not a predicate — `find({})` resolves to "any
        // internal enc key, newest first", the unscoped lookup this decorator
        // exists to forbid. So `{}` is normalised to null here, exactly like
        // `undefined`: the field then reads as bare and either takes the source
        // default or throws `unnamed_encryption_key` at load, never silently
        // encrypting with a key it never named.
        predicate:
          options?.predicate && !isEmpty(options.predicate) ? options.predicate : null,
      },
    });
  };
