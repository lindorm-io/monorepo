import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import type { DbSnapshot } from "../../types/db-snapshot.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type {
  SerializedMigration,
  SerializeMigrationOptions,
} from "./serialize-migration.js";
import type { MigrationTableSettings } from "../../types/migration.js";
import { PostgresMigrationError } from "../../errors/PostgresMigrationError.js";
import { computeHash } from "../../../../utils/migration/compute-hash.js";
import { loadMigrations } from "./load-migrations.js";
import { introspectSchema } from "../sync/introspect-schema.js";
import { projectDesiredSchema } from "../sync/project-desired-schema.js";
import { diffSchema } from "../sync/diff-schema.js";
import { serializeMigration } from "./serialize-migration.js";
import { writeMigrationFile } from "./write-migration-file.js";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-table.js";

export type GenerateBaselineMigrationOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  tableOptions?: MigrationTableSettings;
  // Required: the written baseline is read back through `loadMigrations` so the
  // recorded checksum is the one `apply()` / `status()` recompute.
  logger: ILogger;
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
    // Load the written file back and compute the checksum from the actual module,
    // because that is what apply() and status() compute via computeHash. Any other
    // value records a baseline that can only ever report checksum_mismatch, so
    // refuse rather than mark it applied: the file is on disk and nothing has been
    // recorded yet.
    const loaded = await loadMigrations(options.directory, options.logger);
    const baselineEntry = loaded.find((l) => l.migration.id === migration.id);

    if (!baselineEntry) {
      throw new PostgresMigrationError(
        "Baseline migration could not be read back after writing",
        {
          code: "migration_baseline_unreadable",
          title: "Migration Baseline Unreadable",
          details:
            "The generated baseline migration was written to disk but could not be loaded back, so its checksum cannot be computed the way apply() and status() will. The baseline has NOT been marked as applied — check the migrations directory for import errors and re-run.",
          data: { filepath, migrationId: migration.id },
        },
      );
    }

    const checksum = computeHash(baselineEntry.migration);

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
