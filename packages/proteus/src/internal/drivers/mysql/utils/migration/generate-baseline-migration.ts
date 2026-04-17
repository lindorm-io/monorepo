import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { GenerateBaselineResult } from "../../../../interfaces/MigrationManager";
import type { NamespaceOptions } from "../../../../types/types";
import { computeHash } from "../../../../utils/migration/compute-hash";
import { loadMigrations } from "../../../../utils/migration/load-migrations";
import { writeMigrationFile } from "../../../../utils/migration/write-migration-file";
import type { MysqlDbSnapshot } from "../../types/db-snapshot";
import type { MysqlMigrationTableOptions } from "../../types/migration";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import { diffSchema } from "../sync/diff-schema";
import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchemaMysql } from "../sync/project-desired-schema-mysql";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-table";
import type { SerializeMysqlMigrationOptions } from "./serialize-mysql-migration";
import { serializeMysqlMigration } from "./serialize-mysql-migration";

export type GenerateMysqlBaselineOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  tableOptions?: MysqlMigrationTableOptions;
  logger?: import("@lindorm/logger").ILogger;
};

const EMPTY_SNAPSHOT: MysqlDbSnapshot = {
  tables: new Map(),
};

export const generateMysqlBaselineMigration = async (
  client: MysqlQueryClient,
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
  options: GenerateMysqlBaselineOptions,
): Promise<GenerateBaselineResult> => {
  // 1. Project desired schema from entity metadata
  const desired = projectDesiredSchemaMysql(metadataList, namespaceOptions);

  // 2. Diff against empty snapshot — captures full schema creation
  const plan = diffSchema(EMPTY_SNAPSHOT, desired);

  // 3. Serialize to migration file content
  const serializeOptions: SerializeMysqlMigrationOptions = {
    name: options.name ?? "baseline",
    timestamp: options.timestamp,
  };
  const migration = serializeMysqlMigration(plan, EMPTY_SNAPSHOT, serializeOptions);

  // 4. Introspect live DB (before writing file, so no orphan on failure)
  const managedTables = desired.tables.map((t) => t.name);
  const liveSnapshot = await introspectSchema(client, managedTables);
  const liveDiff = diffSchema(liveSnapshot, desired);

  // 5. Write to disk
  const filepath = await writeMigrationFile(
    options.directory,
    migration.filename,
    migration.content,
  );

  // 6. If live DB matches desired, mark as applied without executing
  let markedAsApplied = false;

  if (liveDiff.operations.length === 0) {
    // Load the written file back and compute checksum from the actual module
    // to ensure it matches what apply-time will compute via computeHash
    const loaded = options.logger
      ? await loadMigrations(options.directory, options.logger)
      : [];
    const baselineEntry = loaded.find((l) => l.migration.id === migration.id);
    const checksum = baselineEntry
      ? computeHash(baselineEntry.migration)
      : migration.checksum;

    await ensureMigrationTable(client, options.tableOptions);

    await client.query("START TRANSACTION");
    try {
      await insertMigrationRecord(
        client,
        {
          id: migration.id,
          name: migration.filename.replace(/\.ts$/, ""),
          checksum,
          createdAt: new Date(migration.ts),
          startedAt: new Date(),
        },
        options.tableOptions,
      );
      await markMigrationFinished(client, migration.id, options.tableOptions);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    }

    markedAsApplied = true;
  }

  return {
    filepath,
    operationCount: plan.operations.length,
    markedAsApplied,
  };
};
