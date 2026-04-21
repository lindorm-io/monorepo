import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "../../../../entity/types/metadata.js";
import { extractEnumValues } from "../../../../utils/extract-enum-values.js";
import { mapFieldTypeSqlite } from "../map-field-type-sqlite.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveFkColumnType } from "../resolve-fk-column-type.js";

const buildEnumCheckExpr = (field: MetaField): string | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  if (values.length === 0) return null;
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `CHECK(${quoteIdentifier(field.name)} IN (${escaped}))`;
};

const buildFieldColumn = (field: MetaField, generated: Array<MetaGenerated>): string => {
  const parts: Array<string> = [quoteIdentifier(field.name)];

  // Computed columns are not supported in SQLite (no GENERATED ALWAYS AS ... STORED for arbitrary expressions).
  // Skip the computed branch — the column will be treated as a regular column.
  // (SQLite 3.31+ supports generated columns but with significant limitations.)
  if (field.computed) {
    parts.push(mapFieldTypeSqlite(field));
    parts.push(`GENERATED ALWAYS AS (${field.computed}) STORED`);
    return parts.join(" ");
  }

  const sqliteType = mapFieldTypeSqlite(field);
  parts.push(sqliteType);

  const gen = generated.find((g) => g.key === field.key);

  if (gen?.strategy === "increment") {
    // AUTOINCREMENT is handled at the table level (INTEGER PRIMARY KEY AUTOINCREMENT)
    // Do not add NOT NULL here — it is implicit for the PK column.
    return parts.join(" ");
  }

  // UUID strategy: no default in SQLite (generated app-side)
  // Literal DEFAULT from field.default (if set)
  if (gen?.strategy !== "uuid") {
    if (field.default !== null && typeof field.default !== "function") {
      const d = field.default;
      if (isString(d)) {
        parts.push(`DEFAULT '${d.replace(/'/g, "''")}'`);
      } else if (isNumber(d)) {
        parts.push(`DEFAULT ${d}`);
      } else if (typeof d === "bigint") {
        parts.push(`DEFAULT ${d}`);
      } else if (isBoolean(d)) {
        parts.push(`DEFAULT ${d ? 1 : 0}`);
      }
    }
  }

  if (!field.nullable) {
    parts.push("NOT NULL");
  }

  // Inline CHECK for enum columns
  const checkExpr = buildEnumCheckExpr(field);
  if (checkExpr) {
    parts.push(checkExpr);
  }

  return parts.join(" ");
};

const buildFkColumn = (
  joinColName: string,
  foreignPkKey: string,
  foreignConstructor: () => any,
  nullable: boolean,
): string => {
  const parts: Array<string> = [quoteIdentifier(joinColName)];
  parts.push(resolveFkColumnType(foreignConstructor, foreignPkKey));

  if (!nullable) {
    parts.push("NOT NULL");
  }

  return parts.join(" ");
};

/**
 * Generates column definition clauses for all field and FK columns of an entity.
 * Returns an array of column definition strings for use inside CREATE TABLE.
 *
 * Handles computed columns (GENERATED ALWAYS AS ... STORED), auto-increment PKs,
 * literal defaults, nullability, and inline CHECK constraints for enum fields.
 * FK columns are auto-generated for owning-side relations (joinKeys !== null,
 * not ManyToMany) unless a non-embedded field with the same column name already exists.
 */
export const generateColumnDDL = (
  metadata: EntityMetadata,
  _tableName: string,
): Array<string> => {
  const columns: Array<string> = [];

  // Field columns
  for (const field of metadata.fields) {
    columns.push(buildFieldColumn(field, metadata.generated));
  }

  // FK columns from owning-side relations (joinKeys !== null, not ManyToMany)
  for (const relation of metadata.relations) {
    if (!relation.joinKeys) continue;
    if (relation.type === "ManyToMany") continue;

    for (const [joinCol, foreignPk] of Object.entries(relation.joinKeys)) {
      // Skip if a non-embedded field with this column name already exists (user-declared FK field)
      if (metadata.fields.some((f) => !f.embedded && f.name === joinCol)) continue;

      columns.push(
        buildFkColumn(
          joinCol,
          foreignPk,
          relation.foreignConstructor,
          relation.options.nullable,
        ),
      );
    }
  }

  return columns;
};
