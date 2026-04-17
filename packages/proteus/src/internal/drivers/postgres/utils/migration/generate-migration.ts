import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { NamespaceOptions } from "../../../../types/types";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type {
  SerializedMigration,
  SerializeMigrationOptions,
} from "./serialize-migration";
import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchema } from "../sync/project-desired-schema";
import { diffSchema } from "../sync/diff-schema";
import { serializeMigration } from "./serialize-migration";
import { writeMigrationFile } from "./write-migration-file";

export type GenerateMigrationOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  writeFile?: boolean;
};

export type GenerateMigrationResult = {
  migration: SerializedMigration;
  filepath: string | null;
  operationCount: number;
  isEmpty: boolean;
};

export const generateMigration = async (
  client: PostgresQueryClient,
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
  options: GenerateMigrationOptions,
): Promise<GenerateMigrationResult> => {
  // 1. Project desired schema from entity metadata
  const desired = projectDesiredSchema(metadataList, namespaceOptions);

  // 2. Build managed tables list for introspection scoping
  const managedTables = desired.tables.map((t) => ({
    schema: t.schema,
    name: t.name,
  }));

  // 3. Introspect current database state
  const snapshot = await introspectSchema(client, managedTables);

  // 4. Diff current vs desired
  const plan = diffSchema(snapshot, desired);

  // 5. Serialize to migration file content
  const serializeOptions: SerializeMigrationOptions = {
    name: options.name,
    timestamp: options.timestamp,
  };
  const migration = serializeMigration(plan, snapshot, serializeOptions);

  const executableOps = plan.operations.filter((op) => op.type !== "warn_only");

  // 6. Write to disk (unless writeFile is explicitly false)
  const filepath =
    options.writeFile !== false
      ? await writeMigrationFile(options.directory, migration.filename, migration.content)
      : null;

  return {
    migration,
    filepath,
    operationCount: executableOps.length,
    isEmpty: executableOps.length === 0,
  };
};
