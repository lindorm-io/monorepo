import { PostgresMigrationError } from "../../errors/PostgresMigrationError.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type {
  MigrationInterface,
  MigrationQueryContext,
  MigrationQueryRunner,
  MigrationTableOptions,
} from "../../types/migration.js";
import {
  deleteMigrationRecord,
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table.js";

export type ExecuteMigrationResult = {
  name: string;
  durationMs: number;
};

const createRunner = (client: PostgresQueryClient): MigrationQueryRunner => ({
  transaction: async (fn): Promise<void> => {
    await client.query("BEGIN");
    try {
      const ctx: MigrationQueryContext = {
        query: async (sql, params): Promise<void> => {
          await client.query(sql, params);
        },
      };
      await fn(ctx);
      await client.query("COMMIT");
    } catch (err) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ROLLBACK failure is secondary — preserve the original error
      }
      throw err;
    }
  },
  query: async (sql, params): Promise<void> => {
    await client.query(sql, params);
  },
});

export const executeMigrationUp = async (
  client: PostgresQueryClient,
  migration: MigrationInterface,
  metadata: { name: string; checksum: string },
  tableOptions?: MigrationTableOptions,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const startedAt = Date.now();

  await insertMigrationRecord(
    client,
    {
      id: migration.id,
      name: metadata.name,
      checksum: metadata.checksum,
      createdAt: new Date(migration.ts),
      startedAt: new Date(startedAt),
    },
    tableOptions,
  );

  const runner = createRunner(client);

  try {
    await migration.up(runner);
  } catch (err) {
    // Clean up orphaned in-progress record — if cleanup fails, preserve original error
    try {
      await deleteMigrationRecord(client, migration.id, tableOptions);
    } catch {
      // Cleanup failure is secondary — the original migration error takes priority
    }
    throw new PostgresMigrationError("Migration up() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationFinished(client, migration.id, tableOptions);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};

export const executeMigrationDown = async (
  client: PostgresQueryClient,
  migration: MigrationInterface,
  metadata: { name: string },
  tableOptions?: MigrationTableOptions,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const startedAt = Date.now();
  const runner = createRunner(client);

  try {
    await migration.down(runner);
  } catch (err) {
    throw new PostgresMigrationError("Migration down() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationRolledBack(client, migration.id, tableOptions);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};
