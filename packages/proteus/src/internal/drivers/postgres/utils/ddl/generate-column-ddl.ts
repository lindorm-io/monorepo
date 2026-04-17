import { isBoolean, isNumber, isString } from "@lindorm/is";
import type {
  EntityMetadata,
  MetaField,
  MetaGenerated,
} from "../../../../entity/types/metadata";
import type { NamespaceOptions } from "../../../../types/types";
import { mapFieldType } from "../map-field-type";
import { quoteIdentifier } from "../quote-identifier";
import { resolveFkColumnType } from "../resolve-fk-column-type";

const buildFieldColumn = (
  field: MetaField,
  generated: Array<MetaGenerated>,
  tableName: string,
  namespace: string | null,
): string => {
  const parts: Array<string> = [quoteIdentifier(field.name)];

  // Computed columns: GENERATED ALWAYS AS (expr) STORED
  if (field.computed) {
    parts.push(mapFieldType(field, tableName, namespace));
    // Raw SQL expression — caller is responsible for correctness and safety
    parts.push(`GENERATED ALWAYS AS (${field.computed}) STORED`);
    return parts.join(" ");
  }

  const pgType = mapFieldType(field, tableName, namespace);
  parts.push(pgType);

  if (field.collation) {
    parts.push(`COLLATE "${field.collation}"`);
  }

  // DEFAULT / GENERATED clause — mutually exclusive branches
  const gen = generated.find((g) => g.key === field.key);
  if (gen?.strategy === "increment") {
    // IDENTITY columns handle NOT NULL implicitly
    parts.push("GENERATED ALWAYS AS IDENTITY");
  } else if (gen?.strategy === "uuid") {
    parts.push("DEFAULT gen_random_uuid()");

    if (!field.nullable) {
      parts.push("NOT NULL");
    }
  } else {
    // Literal DEFAULT from field.default (if set)
    if (field.default !== null && typeof field.default !== "function") {
      const d = field.default;
      if (isString(d)) {
        parts.push(`DEFAULT '${d.replace(/'/g, "''")}'`);
      } else if (isNumber(d)) {
        parts.push(`DEFAULT ${d}`);
      } else if (typeof d === "bigint") {
        parts.push(`DEFAULT ${d}`);
      } else if (isBoolean(d)) {
        parts.push(`DEFAULT ${d}`);
      }
      // Arrays/objects cannot be expressed as SQL literals — skip
    }

    if (!field.nullable) {
      parts.push("NOT NULL");
    }
  }

  return parts.join(" ");
};

const buildFkColumn = (
  joinColName: string,
  foreignPkKey: string,
  foreignConstructor: () => any,
  nullable: boolean,
  namespaceOptions: NamespaceOptions,
): string => {
  const parts: Array<string> = [quoteIdentifier(joinColName)];
  parts.push(resolveFkColumnType(foreignConstructor, foreignPkKey, namespaceOptions));

  if (!nullable) {
    parts.push("NOT NULL");
  }

  return parts.join(" ");
};

/**
 * Generates column definition clauses for all field and FK columns of an entity.
 * Handles computed columns (GENERATED ALWAYS AS ... STORED), identity columns,
 * UUID defaults, literal defaults, collation, and nullability. FK columns are
 * auto-generated for owning-side relations (joinKeys !== null, not ManyToMany)
 * unless a non-embedded field with the same column name already exists.
 */
export const generateColumnDDL = (
  metadata: EntityMetadata,
  tableName: string,
  namespace: string | null,
  namespaceOptions: NamespaceOptions,
): Array<string> => {
  const columns: Array<string> = [];

  // Field columns
  for (const field of metadata.fields) {
    columns.push(buildFieldColumn(field, metadata.generated, tableName, namespace));
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
          namespaceOptions,
        ),
      );
    }
  }

  return columns;
};
