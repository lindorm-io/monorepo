import type { DesiredSchema } from "../../types/desired-schema.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { mapDesiredSchema } from "./map-desired-schema.js";
import { postgresSyncDialect } from "./postgres-sync-dialect.js";
import { projectDesiredSchemaModel } from "../../../../utils/sync/project-desired-schema.js";

/**
 * Projects entity metadata into a `DesiredSchema` structure for comparison with the
 * DB snapshot. Handles extensions, schemas, enum types (with deduplication), tables,
 * columns (including FK and embedded), constraints (PK, UNIQUE, CHECK, FK), indexes,
 * comments, and ManyToMany join tables. FK columns from owning-side relations are
 * auto-generated unless a non-embedded field with the same column name exists.
 *
 * Thin driver entry: the shared core projects a dialect-neutral model through the
 * postgres `SyncDialect`; the mapper renames/regroups it onto the postgres types.
 */
export const projectDesiredSchema = (
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
): DesiredSchema =>
  mapDesiredSchema(
    projectDesiredSchemaModel(metadataList, namespaceOptions, postgresSyncDialect),
  );
