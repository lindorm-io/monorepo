import type { SyncDialect } from "../../../../utils/sync/sync-dialect.js";
import { SQLITE_IDENTIFIER_LIMIT } from "../../constants/sqlite-constants.js";
import { SqliteSyncError } from "../../errors/SqliteSyncError.js";
import { mapFieldTypeSqlite } from "../map-field-type-sqlite.js";
import { mapOnDeleteAction, mapOnUpdateAction } from "./map-referential-action.js";
import { projectAppendOnlyTriggers } from "./project-append-only-triggers.js";
import { projectColumnBehavior } from "./project-column-behavior.js";
import { projectColumnType } from "./project-column-type.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { resolveFkColumnType } from "../resolve-fk-column-type.js";

/**
 * SQLite `SyncDialect` for the shared desired-schema projection. Preserves the
 * historical sqlite projection byte-for-byte: type affinities, inline enum
 * CHECKs, unnamed inline FKs, name-only table dedupe — and the known drift
 * that the raw-metadata FK column-type lookup is kept.
 */
export const sqliteSyncDialect: SyncDialect = {
  identifierLimit: SQLITE_IDENTIFIER_LIMIT,
  namedForeignKeys: false,
  supportsNamespaces: false,
  typedJsonColumnType: "TEXT",
  ordinalColumnType: "INTEGER",

  quoteIdentifier,

  identifierLimitError: (column, entity) =>
    new SqliteSyncError(
      `Column name "${column}" on "${entity}" exceeds ${SQLITE_IDENTIFIER_LIMIT} characters`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details: "A column name exceeds SQLite's maximum identifier length.",
        data: {
          entity,
          column,
          limit: SQLITE_IDENTIFIER_LIMIT,
        },
      },
    ),

  embeddedFkCollisionError: (column, entity, embeddedField) =>
    new SqliteSyncError(
      `Column name "${column}" on "${entity}" collides — embedded field "${embeddedField.key}" produces column "${embeddedField.name}" which conflicts with a relation FK column of the same name`,
      {
        code: "schema_mismatch",
        title: "Schema Mismatch",
        details:
          "An embedded field's column name collides with a relation foreign-key column.",
        data: {
          entity,
          column,
          embeddedField: embeddedField.key,
        },
      },
    ),

  projectColumnType,

  collectionParentFkColumnType: (pkField) =>
    pkField ? mapFieldTypeSqlite(pkField) : "TEXT",

  // Drift (kept): sqlite resolves the FK column type from RAW metadata via the
  // constructor, ignoring the naming strategy.
  resolveFkColumnType: (foreignMeta, foreignPkKey) =>
    resolveFkColumnType(() => foreignMeta.target, foreignPkKey),

  projectColumnBehavior,

  namedEnumType: () => null,

  mapOnDeleteAction,
  mapOnUpdateAction,

  indexColumnPrefixLength: () => null,

  collectExtensions: () => [],

  projectAppendOnlyTriggers,
};
