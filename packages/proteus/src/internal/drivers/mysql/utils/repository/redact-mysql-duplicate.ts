import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { REDACTED } from "../../../../entity/utils/redact-sensitive.js";

// ER_DUP_ENTRY carries the raw conflicting value:
// `Duplicate entry '<value>' for key 'table.key_name'` (MySQL 8 prefixes the table)
const DUP_ENTRY_REGEX = /^Duplicate entry '(.*)' for key '(.+)'$/s;

export type RedactedMysqlDuplicate = {
  detail: string | undefined;
  /** Original error, or a scrubbed clone when the message/stack carried the value. */
  error: Error;
};

/**
 * Resolve an ER_DUP_ENTRY key name to the entity's column keys. MySQL names
 * the KEY, not the columns, so this walks primary keys, @Unique constraints,
 * and unique @Index declarations by name. Returns null when the name cannot
 * be resolved (e.g. a DDL-generated constraint name).
 */
const resolveKeyColumns = (
  metadata: EntityMetadata,
  keyName: string,
): Array<string> | null => {
  const name = keyName.includes(".") ? keyName.slice(keyName.indexOf(".") + 1) : keyName;

  if (name === "PRIMARY") return metadata.primaryKeys;

  const unique = metadata.uniques.find((u) => u.name === name);
  if (unique) return unique.keys;

  const index = metadata.indexes.find((i) => i.unique && i.name === name);
  if (index) return index.keys.map((k) => k.key);

  return null;
};

const isSensitiveColumn = (metadata: EntityMetadata, column: string): boolean =>
  metadata.fields.some(
    (f) => f.sensitive != null && (f.key === column || f.name === column),
  );

/**
 * Redact the raw conflicting value from a MySQL ER_DUP_ENTRY before it lands
 * in proteus error output. Column-precise when the key name resolves against
 * entity metadata; falls back to redacting whenever the entity has any
 * @Sensitive field (unresolvable key name) and fails closed without metadata.
 *
 * The raw driver error's message and stack carry the same value, so when
 * redaction applies a scrubbed clone is returned in place of the original —
 * redacting the wrapped copy while attaching the original would be theater.
 */
export const redactMysqlDuplicateEntry = (
  error: Error,
  detail: string | undefined,
  metadata: EntityMetadata | undefined,
): RedactedMysqlDuplicate => {
  if (!detail) return { detail, error };

  const match = DUP_ENTRY_REGEX.exec(detail);
  if (!match) return { detail, error };

  const [, value, keyName] = match;

  let sensitive: boolean;
  if (!metadata) {
    sensitive = true;
  } else {
    const columns = resolveKeyColumns(metadata, keyName);
    sensitive = columns
      ? columns.some((c) => isSensitiveColumn(metadata, c))
      : metadata.fields.some((f) => f.sensitive != null);
  }

  if (!sensitive) return { detail, error };

  const redactedDetail = `Duplicate entry '${REDACTED}' for key '${keyName}'`;

  const scrub = (text: string): string =>
    value.length > 0 ? text.split(value).join(REDACTED) : text;

  const scrubbed = new Error(scrub(error.message));
  scrubbed.name = error.name;
  if (error.stack) scrubbed.stack = scrub(error.stack);

  return { detail: redactedDetail, error: scrubbed };
};
