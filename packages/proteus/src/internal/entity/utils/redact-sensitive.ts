import type { MetaField } from "../types/metadata.js";

/** Placeholder emitted in error/log output instead of a sensitive field value. */
export const REDACTED = "[Filtered]";

/**
 * Replace a field value with "[Filtered]" when the field is marked @Sensitive.
 * Used at every site where a raw field value would otherwise escape into
 * error-debug payloads — proteus must never emit a sensitive value.
 */
export const redactSensitive = (
  field: Pick<MetaField, "sensitive"> | undefined,
  value: unknown,
): unknown => (field?.sensitive ? REDACTED : value);
