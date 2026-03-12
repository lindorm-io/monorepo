import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { NamespaceOptions } from "#internal/types/types";
import type { DbSnapshot } from "../../types/db-snapshot";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type {
  SerializedMigration,
  SerializeMigrationOptions,
} from "./serialize-migration";
import type { MigrationTableOptions } from "../../types/migration";
import { computeHash } from "#internal/utils/migration/compute-hash";
import { loadMigrations } from "./load-migrations";
import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchema } from "../sync/project-desired-schema";
import { diffSchema } from "../sync/diff-schema";
import { serializeMigration } from "./serialize-migration";
import { writeMigrationFile } from "./write-migration-file";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-table";

export type GenerateBaselineMigrationOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  tableOptions?: MigrationTableOptions;
  logger?: import("@lindorm/logger").ILogger;
};

export type GenerateBaselineMigrationResult = {
  migration: SerializedMigration;
  filepath: string;
  operationCount: number;
  markedAsApplied: boolean;
};

const EMPTY_SNAPSHOT: DbSnapshot = {
  tables: [],
  enums: [],
  schemas: [],
};

export const generateBaselineMigration = async (
  client: PostgresQueryClient,
  metadataList: Array<EntityMetadata>,
  namespaceOptions: NamespaceOptions,
  options: GenerateBaselineMigrationOptions,
): Promise<GenerateBaselineMigrationResult> => {
  // 1. Project desired schema from entity metadata
  const desired = projectDesiredSchema(metadataList, namespaceOptions);

  // 2. Diff against empty snapshot — captures full schema creation
  const plan = diffSchema(EMPTY_SNAPSHOT, desired);

  // 3. Serialize to migration file content
  const serializeOptions: SerializeMigrationOptions = {
    name: options.name ?? "baseline",
    timestamp: options.timestamp,
  };
  const migration = serializeMigration(plan, EMPTY_SNAPSHOT, serializeOptions);

  const executableOps = plan.operations.filter((op) => op.type !== "warn_only");

  // 4. Introspect live DB (before writing file, so no orphan on failure)
  const managedTables = desired.tables.map((t) => ({
    schema: t.schema,
    name: t.name,
  }));
  const liveSnapshot = await introspectSchema(client, managedTables);
  const liveDiff = diffSchema(liveSnapshot, desired);
  const livePending = liveDiff.operations.filter((op) => op.type !== "warn_only");

  // 5. Write to disk
  const filepath = await writeMigrationFile(
    options.directory,
    migration.filename,
    migration.content,
  );

  // 6. If live DB matches desired, mark as applied without executing
  let markedAsApplied = false;

  if (livePending.length === 0) {
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

    await client.query("BEGIN");
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
    migration,
    filepath,
    operationCount: executableOps.length,
    markedAsApplied,
  };
};
