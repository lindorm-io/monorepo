import { SqliteMigrationError } from "../../errors/SqliteMigrationError";
import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import type {
  MigrationInterface,
  MigrationQueryContext,
  MigrationQueryRunner,
  SqliteMigrationTableOptions,
} from "../../types/migration";
import {
  deleteMigrationRecord,
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table";

export type ExecuteMigrationResult = {
  name: string;
  durationMs: number;
};

const createRunner = (client: SqliteQueryClient): MigrationQueryRunner => ({
  transaction: async (fn): Promise<void> => {
    client.exec("BEGIN IMMEDIATE");
    try {
      const ctx: MigrationQueryContext = {
        query: async (sql, params): Promise<void> => {
          if (params && params.length > 0) {
            client.run(sql, params);
          } else {
            client.exec(sql);
          }
        },
      };
      await fn(ctx);
      client.exec("COMMIT");
    } catch (err) {
      try {
        client.exec("ROLLBACK");
      } catch {
        // ROLLBACK failure is secondary — preserve the original error
      }
      throw err;
    }
  },
  query: async (sql, params): Promise<void> => {
    if (params && params.length > 0) {
      client.run(sql, params);
    } else {
      client.exec(sql);
    }
  },
});

export const executeMigrationUp = async (
  client: SqliteQueryClient,
  migration: MigrationInterface,
  metadata: { name: string; checksum: string },
  tableOptions?: SqliteMigrationTableOptions,
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
    throw new SqliteMigrationError("Migration up() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationFinished(client, migration.id, tableOptions);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};

export const executeMigrationDown = async (
  client: SqliteQueryClient,
  migration: MigrationInterface,
  metadata: { name: string },
  tableOptions?: SqliteMigrationTableOptions,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const startedAt = Date.now();
  const runner = createRunner(client);

  try {
    await migration.down(runner);
  } catch (err) {
    throw new SqliteMigrationError("Migration down() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationRolledBack(client, migration.id, tableOptions);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};
