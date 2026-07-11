import type { SyncDialect } from "../../../../utils/sync/sync-dialect.js";
import { extractEnumValues } from "../extract-enum-values.js";
import { getEnumTypeName } from "../get-enum-type-name.js";
import { mapFieldType } from "../map-field-type.js";
import { mapOnDeleteAction, mapOnUpdateAction } from "./map-referential-action.js";
import { PG_IDENTIFIER_LIMIT } from "../../constants/postgres-constants.js";
import { PostgresSyncError } from "../../errors/PostgresSyncError.js";
import { projectAppendOnlyTriggers } from "./project-append-only-triggers.js";
import { projectColumnBehavior } from "./project-column-behavior.js";
import { projectColumnType } from "./project-column-type.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveFkColumnType } from "../resolve-fk-column-type.js";

/**
 * Postgres `SyncDialect` for the shared desired-schema projection. Preserves
 * the historical postgres projection byte-for-byte: named enum types, IDENTITY
 * columns, gen_random_uuid() defaults, schema-qualified names, extensions —
 * and the known drift that collection tables carry no primary key.
 */
export const postgresSyncDialect: SyncDialect = {
  identifierLimit: PG_IDENTIFIER_LIMIT,
  namedForeignKeys: true,
  fkColumnNullableFromRelation: true,
  collectionTableHasPrimaryKey: false,
  supportsNamespaces: true,
  typedJsonColumnType: "JSONB",
  ordinalColumnType: "INTEGER",

  quoteIdentifier,

  identifierLimitError: (column, entity) =>
    new PostgresSyncError(
      `Column name "${column}" on "${entity}" exceeds ${PG_IDENTIFIER_LIMIT} characters`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details: `Column "${column}" on entity "${entity}" exceeds PostgreSQL's ${PG_IDENTIFIER_LIMIT}-character identifier limit.`,
        data: { column, entity },
      },
    ),

  embeddedFkCollisionError: (column, entity, embeddedField) =>
    new PostgresSyncError(
      `Column name "${column}" on "${entity}" collides — embedded field "${embeddedField.key}" produces column "${embeddedField.name}" which conflicts with a relation FK column of the same name`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details: `On entity "${entity}", embedded field "${embeddedField.key}" produces column "${embeddedField.name}" that collides with a relation FK column of the same name.`,
        data: { column, entity },
      },
    ),

  projectColumnType,

  collectionParentFkColumnType: (pkField, tableName, namespace) =>
    pkField ? mapFieldType(pkField, tableName, namespace) : "UUID",

  resolveFkColumnType,

  projectColumnBehavior,

  namedEnumType: (field, tableName, namespace) => {
    if (field.type !== "enum" || !field.enum) return null;
    return {
      schema: namespace ?? "public",
      name: getEnumTypeName(tableName, field.name),
      values: extractEnumValues(field.enum),
    };
  },

  mapOnDeleteAction,
  mapOnUpdateAction,

  indexColumnPrefixLength: () => null,

  collectExtensions: (fields, indexes) => {
    const extensions: Array<string> = [];
    if (fields.some((f) => f.type === "vector")) {
      extensions.push("vector");
    }
    if (
      indexes.some((index) => index.keys.some((k) => k.opclass?.endsWith("_trgm_ops")))
    ) {
      extensions.push("pg_trgm");
    }
    return extensions;
  },

  projectAppendOnlyTriggers,
};
