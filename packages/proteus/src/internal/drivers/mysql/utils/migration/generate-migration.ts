import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { GenerateMigrationResult } from "../../../../interfaces/MigrationManager.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { writeMigrationFile } from "../../../../utils/migration/write-migration-file.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { diffSchema } from "../sync/diff-schema.js";
import { introspectSchema } from "../sync/introspect-schema.js";
import { projectDesiredSchemaMysql } from "../sync/project-desired-schema-mysql.js";
import type { SerializeMysqlMigrationOptions } from "./serialize-mysql-migration.js";
import { serializeMysqlMigration } from "./serialize-mysql-migration.js";

export type GenerateMysqlMigrationOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  writeFile?: boolean;
};

export const generateMysqlMigration = async (
  client: MysqlQueryClient,
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
  options: GenerateMysqlMigrationOptions,
): Promise<GenerateMigrationResult> => {
  // 1. Project desired schema from entity metadata
  const desired = projectDesiredSchemaMysql(metadataList, namespaceOptions);

  // 2. Build managed tables list for introspection scoping
  const managedTables = desired.tables.map((t) => t.name);

  // 3. Introspect current database state
  const snapshot = await introspectSchema(client, managedTables);

  // 4. Diff current vs desired
  const plan = diffSchema(snapshot, desired);

  // 5. Serialize to migration file content
  const serializeOptions: SerializeMysqlMigrationOptions = {
    name: options.name,
    timestamp: options.timestamp,
  };
  const migration = serializeMysqlMigration(plan, snapshot, serializeOptions);

  // 6. Write to disk (unless writeFile is explicitly false)
  const filepath =
    options.writeFile !== false
      ? await writeMigrationFile(options.directory, migration.filename, migration.content)
      : null;

  return {
    filepath,
    operationCount: plan.operations.length,
    isEmpty: plan.operations.length === 0,
  };
};
