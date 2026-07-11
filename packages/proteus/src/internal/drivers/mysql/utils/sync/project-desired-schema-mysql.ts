import type { MysqlDesiredSchema } from "../../types/desired-schema.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { mapDesiredSchema } from "./map-desired-schema.js";
import { mysqlSyncDialect } from "./mysql-sync-dialect.js";
import { projectDesiredSchemaModel } from "../../../../utils/sync/project-desired-schema.js";

/**
 * Projects entity metadata into a `MysqlDesiredSchema` structure for comparison with
 * the DB snapshot. Handles tables, columns (including FK and embedded), constraints
 * (PK, UNIQUE, CHECK, FK), indexes, and ManyToMany join tables.
 *
 * MySQL differences from PG/SQLite:
 * - No schema qualification (database is specified in connection)
 * - Enum values are part of the column type (ENUM('a','b','c'))
 * - AUTO_INCREMENT instead of AUTOINCREMENT/GENERATED
 * - Named FK constraints with hash-based names
 * - TEXT/BLOB columns need prefix lengths for indexing
 *
 * Thin driver entry: the shared core projects a dialect-neutral model through the
 * MySQL `SyncDialect`; the mapper renames/regroups it onto the mysql types.
 */
export const projectDesiredSchemaMysql = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): MysqlDesiredSchema =>
  mapDesiredSchema(
    projectDesiredSchemaModel(metadataList, namespaceOptions, mysqlSyncDialect),
  );
