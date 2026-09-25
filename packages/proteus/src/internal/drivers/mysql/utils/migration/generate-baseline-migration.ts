import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import { MySqlMigrationError } from "../../errors/MySqlMigrationError.js";
import type { GenerateBaselineResult } from "../../../../interfaces/MigrationManager.js";
import type { NamespaceOptions } from "../../../../types/types.js";
import { computeHash } from "../../../../utils/migration/compute-hash.js";
import { loadMigrations } from "../../../../utils/migration/load-migrations.js";
import { writeMigrationFile } from "../../../../utils/migration/write-migration-file.js";
import type { MysqlDbSnapshot } from "../../types/db-snapshot.js";
import type { MysqlMigrationTableSettings } from "../../types/migration.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { diffSchema } from "../sync/diff-schema.js";
import { introspectSchema } from "../sync/introspect-schema.js";
import { projectDesiredSchemaMysql } from "../sync/project-desired-schema-mysql.js";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-table.js";
import type { SerializeMysqlMigrationOptions } from "./serialize-mysql-migration.js";
import { serializeMysqlMigration } from "./serialize-mysql-migration.js";

export type GenerateMysqlBaselineOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  tableOptions?: MysqlMigrationTableSettings;
  // Required: the written baseline is read back through `loadMigrations` so the
  // recorded checksum is the one `apply()` / `status()` recompute.
  logger: ILogger;
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
    // Load the written file back and compute the checksum from the actual module,
    // because that is what apply() and status() compute via computeHash. Any other
    // value records a baseline that can only ever report checksum_mismatch, so
    // refuse rather than mark it applied: the file is on disk and nothing has been
    // recorded yet.
    const loaded = await loadMigrations(options.directory, options.logger);
    const baselineEntry = loaded.find((l) => l.migration.id === migration.id);

    if (!baselineEntry) {
      throw new MySqlMigrationError(
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
