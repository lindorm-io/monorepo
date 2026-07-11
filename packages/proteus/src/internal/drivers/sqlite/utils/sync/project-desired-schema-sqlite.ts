import type { SqliteDesiredSchema } from "../../types/desired-schema.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { mapDesiredSchema } from "./map-desired-schema.js";
import { projectDesiredSchemaModel } from "../../../../utils/sync/project-desired-schema.js";
import { sqliteSyncDialect } from "./sqlite-sync-dialect.js";

/**
 * Projects entity metadata into a `SqliteDesiredSchema` structure for comparison with
 * the DB snapshot. Handles tables, columns (including FK and embedded), constraints
 * (PK, UNIQUE, CHECK, FK), indexes, and ManyToMany join tables.
 *
 * SQLite differences from PG:
 * - No enum types (inline CHECK constraints instead)
 * - No schema tracking
 * - No extensions
 * - No comments
 * - FKs are inline in CREATE TABLE
 *
 * Thin driver entry: the shared core projects a dialect-neutral model through the
 * SQLite `SyncDialect`; the mapper renames/regroups it onto the sqlite types.
 */
export const projectDesiredSchemaSqlite = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): SqliteDesiredSchema =>
  mapDesiredSchema(
    projectDesiredSchemaModel(metadataList, namespaceOptions, sqliteSyncDialect),
  );
