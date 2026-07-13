import type { Dict } from "@lindorm/types";
import type { MessageMetadata, MetaField } from "../types/metadata.js";

/** Placeholder emitted in log output instead of a sensitive field value. */
export const REDACTED = "[Filtered]";

/**
 * Replace a field value with "[Filtered]" when the field is marked @Sensitive.
 * Used at every site where a raw field value would otherwise escape into log
 * output — iris must never emit a sensitive value.
 */
export const redactSensitive = (
  field: Pick<MetaField, "sensitive"> | undefined,
  value: unknown,
): unknown => (field?.sensitive ? REDACTED : value);

/**
 * Redacted copy of a whole message, for the sites that log the message itself.
 *
 * Message fields are flat, and a @Header property is required to carry a @Field
 * too (see validateHeaders), so walking `fields` covers every value that lives on
 * the message — header properties included. The message is never mutated; only the
 * sensitive values are replaced.
 */
export const redactSensitiveMessage = <M extends Dict>(
  metadata: Pick<MessageMetadata, "fields">,
  message: M,
): M => {
  const sensitive = metadata.fields.filter((field) => field.sensitive);

  if (!sensitive.length) return message;

  const result: Dict = { ...message };

  for (const field of sensitive) {
    if (result[field.key] !== undefined) result[field.key] = REDACTED;
  }

  return result as M;
};
