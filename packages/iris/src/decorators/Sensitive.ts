import { stageFieldModifier } from "../internal/message/metadata/stage-metadata.js";
import type { SensitiveDigest } from "../internal/message/types/metadata.js";

export type SensitiveOptions = {
  digest?: SensitiveDigest;
};

/**
 * Mark a field as sensitive. Iris never emits the field's value in its own
 * log output (it is replaced with "[Filtered]"), and the flag is visible in
 * message metadata so consumers can register logger filters.
 *
 * - `@Sensitive()` — redaction only, valid on any field type.
 * - `@Sensitive({ digest: "sha256" })` — additionally validates that the carried
 *   value LOOKS like a digest of the declared algorithm (catches plaintext sent
 *   in a hash field). Requires a "string" field.
 *
 * A @Header property is also a @Field, so a header value is redacted the same way.
 *
 * Iris performs no hashing or cryptographic verification — producing and verifying
 * digests stays in the crypto layer. Redaction covers iris-generated log output;
 * the broker's own logs and the consumer's handling of the message are outside its
 * reach. Orthogonal to @Encrypted, which encrypts the payload on the wire.
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
