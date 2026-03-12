import type { EntityMetadata } from "#internal/entity/types/metadata";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";

export const buildSimpleIn = (
  metadata: EntityMetadata | null,
  fieldKeys: Array<string>,
  values: Array<Array<unknown>>,
  params: Array<unknown>,
): string => {
  if (values.length === 0) {
    throw new Error(
      "buildSimpleIn: values array must not be empty — IN () is invalid SQL",
    );
  }

  if (fieldKeys.length === 1) {
    const colName = metadata
      ? resolveColumnNameSafe(metadata.fields, fieldKeys[0])
      : fieldKeys[0];
    const placeholders = values.map((vals) => {
      params.push(vals[0]);
      return `$${params.length}`;
    });
    return `${quoteIdentifier(colName)} IN (${placeholders.join(", ")})`;
  }

  const cols = fieldKeys.map((k) => {
    const colName = metadata ? resolveColumnNameSafe(metadata.fields, k) : k;
    return quoteIdentifier(colName);
  });
  const tuples = values.map((vals) => {
    const placeholders = vals.map((v) => {
      params.push(v);
      return `$${params.length}`;
    });
    return `(${placeholders.join(", ")})`;
  });
  return `ROW(${cols.join(", ")}) IN (${tuples.join(", ")})`;
};
