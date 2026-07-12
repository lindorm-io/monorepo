import type { SensitiveDigest } from "../internal/entity/types/metadata.js";
import { stageFieldModifier } from "../internal/entity/metadata/stage-metadata.js";

export type SensitiveOptions = {
  digest?: SensitiveDigest;
};

/**
 * Mark a field as sensitive. Proteus never emits the field's value in its own
 * log/error output (it is replaced with "[Filtered]"), and the flag is visible
 * in entity metadata so consumers can register logger filters.
 *
 * - `@Sensitive()` — redaction only, valid on any field type.
 * - `@Sensitive({ digest: "sha256" })` — additionally validates that the stored
 *   value LOOKS like a digest of the declared algorithm (catches plaintext stored
 *   in a hash column). Requires a string-family field type (string, varchar, text).
 *
 * Proteus performs no hashing or cryptographic verification — producing and
 * verifying digests stays in the crypto layer.
 */
export const Sensitive =
  (options?: SensitiveOptions) =>
  (_target: undefined, context: ClassFieldDecoratorContext): void => {
    stageFieldModifier(context.metadata, {
      key: String(context.name),
      decorator: "Sensitive",
      sensitive: { digest: options?.digest ?? null },
    });
  };
