import type { EntityMetadata } from "#internal/entity/types/metadata";
import { quoteIdentifier, quoteQualifiedName } from "../quote-identifier";

const escapeComment = (text: string): string => text.replace(/'/g, "''");

/**
 * Generates `COMMENT ON TABLE` and `COMMENT ON COLUMN` statements for the entity's
 * table-level and field-level comments. Single quotes in comment text are escaped.
 */
export const generateCommentDDL = (
  metadata: EntityMetadata,
  tableName: string,
  namespace: string | null,
): Array<string> => {
  const qualifiedTable = quoteQualifiedName(namespace, tableName);
  const statements: Array<string> = [];

  if (metadata.entity.comment) {
    statements.push(
      `COMMENT ON TABLE ${qualifiedTable} IS '${escapeComment(metadata.entity.comment)}';`,
    );
  }

  for (const field of metadata.fields) {
    if (!field.comment) continue;
    statements.push(
      `COMMENT ON COLUMN ${qualifiedTable}.${quoteIdentifier(field.name)} IS '${escapeComment(field.comment)}';`,
    );
  }

  return statements;
};
