import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { generateAppendOnlyDDL } from "./generate-append-only-ddl.js";
import { generateIndexDDL } from "./generate-index-ddl.js";
import { generateJoinTableDDL } from "./generate-join-table-ddl.js";
import { generateTableDDL } from "./generate-table-ddl.js";

export type SqliteDdlOutput = {
  tables: Array<string>;
  indexes: Array<string>;
  triggers: Array<string>;
};

/**
 * Generates all DDL statements for a single entity: table CREATE, join tables,
 * and indexes. Returns categorised output so the caller can order statements.
 *
 * SQLite does not need: schemas, enum types, FK constraints (inline), comments,
 * or extensions.
 */
export const generateEntityDDL = (
  metadata: EntityMetadata,
  namespaceOptions: NamespaceOptions,
): SqliteDdlOutput => {
  const entityName = getEntityName(metadata.target, namespaceOptions);
  const tableName = entityName.name;

  const output: SqliteDdlOutput = {
    tables: [],
    indexes: [],
    triggers: [],
  };

  // Table
  output.tables.push(generateTableDDL(metadata, tableName));

  // Join tables (ManyToMany)
  const joinDDL = generateJoinTableDDL(metadata, namespaceOptions);
  output.tables.push(...joinDDL.tables);
  output.indexes.push(...joinDDL.indexes);

  // Indexes
  output.indexes.push(...generateIndexDDL(metadata.indexes, tableName, metadata.fields));

  // Append-only triggers
  if (metadata.appendOnly) {
    output.triggers.push(...generateAppendOnlyDDL(tableName));
  }

  return output;
};
