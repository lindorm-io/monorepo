import { buildMysqlLockName } from "#internal/utils/advisory-lock-name";
import { MySqlMigrationError } from "../../errors/MySqlMigrationError";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import type {
  MigrationInterface,
  MigrationQueryContext,
  MigrationQueryRunner,
  MysqlMigrationTableOptions,
} from "../../types/migration";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFailed,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table";

export type ExecuteMigrationResult = {
  name: string;
  durationMs: number;
};

const createRunner = (client: MysqlQueryClient): MigrationQueryRunner => ({
  transaction: async (fn): Promise<void> => {
    await client.query("START TRANSACTION");
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

/**
 * Acquires a MySQL advisory lock for migration operations.
 * Returns true if the lock was acquired, false otherwise.
 */
const acquireMigrationLock = async (
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<boolean> => {
  const lockName = buildMysqlLockName("proteus_migration", namespace);
  const { rows } = await client.query<{ lock_result: number | null }>(
    `SELECT GET_LOCK(?, 30) AS lock_result`,
    [lockName],
  );
  return rows[0]?.lock_result === 1;
};

const releaseMigrationLock = async (
  client: MysqlQueryClient,
  namespace: string | null,
): Promise<void> => {
  const lockName = buildMysqlLockName("proteus_migration", namespace);
  try {
    await client.query(`SELECT RELEASE_LOCK(?)`, [lockName]);
  } catch {
    // Best effort — lock will expire on session close
  }
};

export const executeMigrationUp = async (
  client: MysqlQueryClient,
  migration: MigrationInterface,
  metadata: { name: string; checksum: string },
  tableOptions?: MysqlMigrationTableOptions,
  namespace?: string | null,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const lockAcquired = await acquireMigrationLock(client, namespace ?? null);
  if (!lockAcquired) {
    throw new MySqlMigrationError(
      "Could not acquire migration advisory lock — another migration is running",
    );
  }

  const startedAt = Date.now();

  try {
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
      // Mark as failed (started_at set, finished_at = NULL) so the record
      // persists for crash detection rather than being silently deleted.
      try {
        await markMigrationFailed(client, migration.id, tableOptions);
      } catch {
        // Mark-failed failure is secondary — preserve the original error
      }
      throw new MySqlMigrationError("Migration up() failed", {
        debug: { id: migration.id, name: metadata.name },
        error: err as Error,
      });
    }

    await markMigrationFinished(client, migration.id, tableOptions);
  } finally {
    await releaseMigrationLock(client, namespace ?? null);
  }

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};

export const executeMigrationDown = async (
  client: MysqlQueryClient,
  migration: MigrationInterface,
  metadata: { name: string },
  tableOptions?: MysqlMigrationTableOptions,
  namespace?: string | null,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const lockAcquired = await acquireMigrationLock(client, namespace ?? null);
  if (!lockAcquired) {
    throw new MySqlMigrationError(
      "Could not acquire migration advisory lock — another migration is running",
    );
  }

  const startedAt = Date.now();

  try {
    const runner = createRunner(client);

    try {
      await migration.down(runner);
    } catch (err) {
      throw new MySqlMigrationError("Migration down() failed", {
        debug: { id: migration.id, name: metadata.name },
        error: err as Error,
      });
    }

    await markMigrationRolledBack(client, migration.id, tableOptions);
  } finally {
    await releaseMigrationLock(client, namespace ?? null);
  }

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};
