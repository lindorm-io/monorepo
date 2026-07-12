import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { REDACTED } from "../../../../entity/utils/redact-sensitive.js";

// PostgreSQL constraint details that carry raw row values:
// - 23505 / 23503: `Key (col1, col2)=(v1, v2) already exists.` / `... is not present in table "t".`
// - 23502 / 23514: `Failing row contains (v1, v2, ...).`
const KEY_VALUE_REGEX = /^(Key \((.+?)\)=)\((.*)\)(.*)$/s;
const FAILING_ROW_REGEX = /^(Failing row contains )\((.*)\)(.*)$/s;

// pg quotes identifiers that need quoting (e.g. camelCase column names)
const stripQuotes = (column: string): string =>
  column.startsWith('"') && column.endsWith('"') ? column.slice(1, -1) : column;

const isSensitiveColumn = (metadata: EntityMetadata, column: string): boolean =>
  metadata.fields.some(
    (f) => f.sensitive != null && (f.name === column || f.key === column),
  );

/**
 * Redact raw row values from a PostgreSQL error detail before it lands in
 * proteus error output. Column-precise when metadata is available: only the
 * value portion is filtered, and only when a named column is @Sensitive (or,
 * for `Failing row contains` which names no columns, when the entity has any
 * sensitive field). Without metadata (e.g. the COMMIT path, where deferred
 * constraints can fire for any entity) redaction fails closed.
 */
export const redactPgDetail = (
  detail: string | undefined,
  metadata: EntityMetadata | undefined,
): string | undefined => {
  if (!detail) return detail;

  const keyMatch = KEY_VALUE_REGEX.exec(detail);
  if (keyMatch) {
    const [, prefix, columns, , suffix] = keyMatch;
    const names = columns.split(",").map((c) => stripQuotes(c.trim()));
    const sensitive = metadata ? names.some((c) => isSensitiveColumn(metadata, c)) : true;
    return sensitive ? `${prefix}(${REDACTED})${suffix}` : detail;
  }

  const rowMatch = FAILING_ROW_REGEX.exec(detail);
  if (rowMatch) {
    const [, prefix, , suffix] = rowMatch;
    const sensitive = metadata ? metadata.fields.some((f) => f.sensitive != null) : true;
    return sensitive ? `${prefix}(${REDACTED})${suffix}` : detail;
  }

  return detail;
};
