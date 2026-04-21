import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { getEntityName } from "../../../../entity/utils/get-entity-name.js";
import { generateAppendOnlyDDL } from "./generate-append-only-ddl.js";
import { generateEnumTypeDDL } from "./generate-enum-type-ddl.js";
import { generateFkDDL } from "./generate-fk-ddl.js";
import { generateIndexDDL } from "./generate-index-ddl.js";
import { generateJoinTableDDL } from "./generate-join-table-ddl.js";
import { quoteIdentifier } from "../quote-identifier.js";
import { generateCommentDDL } from "./generate-comment-ddl.js";
import { generateTableDDL } from "./generate-table-ddl.js";

export type DdlOutput = {
  extensions: Array<string>;
  schemas: Array<string>;
  types: Array<string>;
  tables: Array<string>;
  constraints: Array<string>;
  indexes: Array<string>;
  comments: Array<string>;
  triggers: Array<string>;
};

/**
 * Generates all DDL statements for a single entity: schema, enum types, table,
 * join tables, FK constraints, indexes, and comments. Returns categorised output
 * so the caller can order statements (e.g. types before tables, tables before FKs).
 */
export const generateEntityDDL = (
  metadata: EntityMetadata,
  namespaceOptions: NamespaceOptions,
): DdlOutput => {
  const entityName = getEntityName(metadata.target, namespaceOptions);
  const { namespace, name: tableName } = entityName;

  const output: DdlOutput = {
    extensions: [],
    schemas: [],
    types: [],
    tables: [],
    constraints: [],
    indexes: [],
    comments: [],
    triggers: [],
  };

  // Extensions — auto-detect from field types
  const hasVector = metadata.fields.some((f) => f.type === "vector");
  if (hasVector) {
    output.extensions.push("CREATE EXTENSION IF NOT EXISTS vector;");
  }

  // Schema
  if (namespace) {
    output.schemas.push(`CREATE SCHEMA IF NOT EXISTS ${quoteIdentifier(namespace)};`);
  }

  // Enum types
  output.types.push(...generateEnumTypeDDL(metadata.fields, tableName, namespace));

  // Table
  output.tables.push(generateTableDDL(metadata, tableName, namespace, namespaceOptions));

  // Join tables (ManyToMany)
  const joinDDL = generateJoinTableDDL(metadata, namespace, namespaceOptions);
  output.tables.push(...joinDDL.tables);
  output.indexes.push(...joinDDL.indexes);

  // FK constraints
  output.constraints.push(
    ...generateFkDDL(metadata, tableName, namespace, namespaceOptions),
  );

  // Indexes
  output.indexes.push(
    ...generateIndexDDL(metadata.indexes, tableName, namespace, metadata.fields),
  );

  // Comments
  output.comments.push(...generateCommentDDL(metadata, tableName, namespace));

  // Append-only triggers
  if (metadata.appendOnly) {
    output.triggers.push(...generateAppendOnlyDDL(tableName, namespace));
  }

  return output;
};
