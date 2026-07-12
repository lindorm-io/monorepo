import type { SyncDialect } from "../../../../utils/sync/sync-dialect.js";
import {
  INDEX_PREFIX_LENGTH,
  MYSQL_IDENTIFIER_LIMIT,
} from "../../constants/mysql-constants.js";
import { MySqlSyncError } from "../../errors/MySqlSyncError.js";
import { mapFieldTypeMysql } from "../map-field-type-mysql.js";
import { mapOnDeleteAction, mapOnUpdateAction } from "./map-referential-action.js";
import { projectAppendOnlyTriggers } from "./project-append-only-triggers.js";
import { projectColumnBehavior } from "./project-column-behavior.js";
import { projectColumnType } from "./project-column-type.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { requiresIndexPrefix } from "../requires-index-prefix.js";
import { resolveFkColumnType } from "../resolve-fk-column-type.js";

/**
 * MySQL `SyncDialect` for the shared desired-schema projection. Preserves the
 * historical mysql projection byte-for-byte: inline enum(...) types, lowercased
 * type spellings, AUTO_INCREMENT (increment only — `@Generated("identity")` is
 * ignored), TEXT/BLOB index prefix lengths, name-only table dedupe, and the
 * raw-metadata FK column-type lookup (known drift, kept).
 */
export const mysqlSyncDialect: SyncDialect = {
  identifierLimit: MYSQL_IDENTIFIER_LIMIT,
  namedForeignKeys: true,
  supportsNamespaces: false,
  typedJsonColumnType: "JSON",
  ordinalColumnType: "int",

  quoteIdentifier,

  identifierLimitError: (column, entity) =>
    new MySqlSyncError(
      `Column name "${column}" on "${entity}" exceeds ${MYSQL_IDENTIFIER_LIMIT} characters`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details: "A column name exceeds the maximum MySQL identifier length.",
        data: { column, entity },
      },
    ),

  embeddedFkCollisionError: (column, entity, embeddedField) =>
    new MySqlSyncError(
      `Column name "${column}" on "${entity}" collides — embedded field "${embeddedField.key}" produces column "${embeddedField.name}" which conflicts with a relation FK column of the same name`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details:
          "An embedded field produces a column name that collides with a relation foreign key column.",
        data: { column, entity },
      },
    ),

  projectColumnType,

  collectionParentFkColumnType: (pkField) =>
    pkField ? mapFieldTypeMysql(pkField).toLowerCase() : "varchar(255)",

  // Drift (kept): mysql resolves the FK column type from RAW metadata via the
  // constructor, ignoring the naming strategy, and lowercases the result.
  resolveFkColumnType: (foreignMeta, foreignPkKey) =>
    resolveFkColumnType(() => foreignMeta.target, foreignPkKey).toLowerCase(),

  projectColumnBehavior,

  namedEnumType: () => null,

  mapOnDeleteAction,
  mapOnUpdateAction,

  indexColumnPrefixLength: (field) =>
    requiresIndexPrefix(field) ? INDEX_PREFIX_LENGTH : null,

  collectExtensions: () => [],

  projectAppendOnlyTriggers,
};
