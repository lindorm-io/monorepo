import { ProteusError } from "../../../../../errors";
import type { MetaField } from "#internal/entity/types/metadata";
import { extractEnumValues } from "../extract-enum-values";
import { getEnumTypeName } from "../get-enum-type-name";
import { quoteQualifiedName } from "../quote-identifier";

/**
 * Generates `CREATE TYPE ... AS ENUM (...)` statements for enum-typed fields. Each
 * statement is wrapped in a `DO $$ BEGIN ... EXCEPTION WHEN duplicate_object THEN NULL;
 * END $$;` block for idempotent execution. Validates that enum fields have non-empty
 * value lists and that type/values are consistent.
 */
export const generateEnumTypeDDL = (
  fields: Array<MetaField>,
  tableName: string,
  namespace: string | null,
): Array<string> => {
  const statements: Array<string> = [];

  for (const field of fields) {
    if (field.enum && field.type !== "enum") {
      throw new ProteusError(
        `Field "${field.key}" has enum values but type is "${field.type}" — expected "enum"`,
      );
    }

    if (field.type !== "enum") continue;

    if (!field.enum) {
      throw new ProteusError(
        `Field "${field.key}" has type "enum" but no enum values provided`,
      );
    }

    const values = extractEnumValues(field.enum);

    if (values.length === 0) {
      throw new ProteusError(`Enum for field "${field.key}" has no values`);
    }

    const typeName = getEnumTypeName(tableName, field.name);
    const qualifiedName = quoteQualifiedName(namespace, typeName);
    const valueList = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");

    statements.push(
      `DO $$ BEGIN CREATE TYPE ${qualifiedName} AS ENUM (${valueList}); EXCEPTION WHEN duplicate_object THEN NULL; END $$;`,
    );
  }

  return statements;
};
