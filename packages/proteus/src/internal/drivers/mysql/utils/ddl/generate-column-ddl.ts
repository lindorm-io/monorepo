import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "../../../../entity/types/metadata";
import { extractEnumValues } from "../../../../utils/extract-enum-values";
import { mapFieldTypeMysql } from "../map-field-type-mysql";
import { quoteIdentifier } from "../quote-identifier";
import { resolveFkColumnType } from "../resolve-fk-column-type";

const buildEnumType = (field: MetaField): string | null => {
  if (field.type !== "enum" || !field.enum) return null;
  const values = extractEnumValues(field.enum);
  if (values.length === 0) return null;
  const escaped = values.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ");
  return `ENUM(${escaped})`;
};

const buildFieldColumn = (field: MetaField, generated: Array<MetaGenerated>): string => {
  const parts: Array<string> = [quoteIdentifier(field.name)];

  // Computed columns: GENERATED ALWAYS AS (expr) STORED
  if (field.computed) {
    parts.push(mapFieldTypeMysql(field));
    parts.push(`GENERATED ALWAYS AS (${field.computed}) STORED`);
    return parts.join(" ");
  }

  // Enum columns use inline ENUM('val1','val2') instead of the type mapper
  const enumType = buildEnumType(field);
  if (enumType) {
    parts.push(enumType);
  } else {
    parts.push(mapFieldTypeMysql(field));
  }

  const gen = generated.find((g) => g.key === field.key);

  if (gen?.strategy === "increment") {
    // AUTO_INCREMENT — NOT NULL is implicit for PK columns
    parts.push("AUTO_INCREMENT");
    return parts.join(" ");
  }

  // UUID strategy: no default in MySQL (generated app-side)
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

  // No inline CHECK constraints in MySQL — they are added via generate-check-ddl

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
 * Handles computed columns (GENERATED ALWAYS AS ... STORED), AUTO_INCREMENT PKs,
 * inline ENUM types, literal defaults, nullability. CHECK constraints are NOT
 * added inline — they are generated separately for MySQL.
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
