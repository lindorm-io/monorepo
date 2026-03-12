import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { NamespaceOptions } from "#internal/types/types";
import { getEntityName } from "#internal/entity/utils/get-entity-name";
import { generateIndexDDL } from "./generate-index-ddl";
import { generateJoinTableDDL } from "./generate-join-table-ddl";
import { generateTableDDL } from "./generate-table-ddl";

export type MysqlDdlOutput = {
  tables: Array<string>;
  indexes: Array<string>;
};

/**
 * Generates all DDL statements for a single entity: table CREATE, join tables,
 * and indexes. Returns categorised output so the caller can order statements.
 *
 * MySQL does not need: schemas (database-level), enum types (inline ENUM),
 * extensions, or comments in DDL.
 */
export const generateEntityDDL = (
  metadata: EntityMetadata,
  namespaceOptions: NamespaceOptions,
): MysqlDdlOutput => {
  const entityName = getEntityName(metadata.target, namespaceOptions);
  const tableName = entityName.name;

  const output: MysqlDdlOutput = {
    tables: [],
    indexes: [],
  };

  // Table
  output.tables.push(generateTableDDL(metadata, tableName));

  // Join tables (ManyToMany)
  const joinDDL = generateJoinTableDDL(metadata, namespaceOptions);
  output.tables.push(...joinDDL.tables);
  output.indexes.push(...joinDDL.indexes);

  // Indexes
  output.indexes.push(...generateIndexDDL(metadata.indexes, tableName, metadata.fields));

  return output;
};
