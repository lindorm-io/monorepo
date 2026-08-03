import type { ILogger } from "@lindorm/logger";
import { PostgresMigrationError } from "../../errors/PostgresMigrationError.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type {
  MigrationInterface,
  MigrationQueryContext,
  MigrationQueryRunner,
  MigrationTableSettings,
} from "../../types/migration.js";
import {
  createExtensionLocked,
  type CreateExtensionOutcome,
} from "../create-extension.js";
import { quoteIdentifier } from "../quote-identifier.js";
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

const createRunner = (
  client: PostgresQueryClient,
  logger?: ILogger,
): MigrationQueryRunner => ({
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
  extension: async (name): Promise<void> => {
    // The migration lock is per-namespace, so it cannot serialize a
    // database-scoped extension — createExtensionLocked takes the database-wide
    // one, in its own transaction, sharing the key pair with schema sync.
    const description = `Create extension ${quoteIdentifier(name)}`;
    const outcome = await createExtensionLocked(client, {
      description,
      extension: name,
      // Wait indefinitely: the migration path exposes no lock-timeout option,
      // and a migration that silently skips its extension is worse than one
      // that waits for the peer holding the lock.
      lockTimeoutMs: 0,
      logger,
      sql: `CREATE EXTENSION IF NOT EXISTS ${quoteIdentifier(name)};`,
    });

    switch (outcome.status) {
      case "created":
      case "already_present":
        return;

      case "lock_timeout":
        throw new PostgresMigrationError(
          `Timed out waiting for the extension lock while creating "${name}"`,
          {
            code: "migration_lock_unavailable",
            title: "Migration Lock Unavailable",
            details:
              "A migration could not acquire the database-wide extension lock (a server-side `lock_timeout` cut the wait short) — another session is creating an extension in this database. Retry once it finishes.",
            data: { extension: name },
            error: outcome.error,
          },
        );

      case "failed":
        throw new PostgresMigrationError(`Failed to create extension "${name}"`, {
          code: "migration_failed",
          title: "Migration Failed",
          details:
            "A migration could not create a required PostgreSQL extension; the extension transaction was rolled back and the rest of the migration did not run.",
          data: { extension: name },
          error: outcome.error,
        });

      default:
        throw new PostgresMigrationError(
          `Unhandled extension outcome: "${(outcome as CreateExtensionOutcome).status}"`,
          {
            code: "migration_failed",
            title: "Migration Failed",
            details:
              "Creating a PostgreSQL extension returned an outcome the migration runner does not handle.",
            data: { extension: name },
          },
        );
    }
  },
});

export const executeMigrationUp = async (
  client: PostgresQueryClient,
  migration: MigrationInterface,
  metadata: { name: string; checksum: string },
  tableOptions?: MigrationTableSettings,
  logger?: ILogger,
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

  const runner = createRunner(client, logger);

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
      code: "migration_failed",
      title: "Migration Failed",
      details: `The up() function of migration "${metadata.name}" threw; its orphaned in-progress record has been cleaned up.`,
      data: { migration: metadata.name },
      debug: { id: migration.id },
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
  tableOptions?: MigrationTableSettings,
  logger?: ILogger,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationTable(client, tableOptions);

  const startedAt = Date.now();
  const runner = createRunner(client, logger);

  try {
    await migration.down(runner);
  } catch (err) {
    throw new PostgresMigrationError("Migration down() failed", {
      code: "migration_failed",
      title: "Migration Failed",
      details: `The down() function of migration "${metadata.name}" threw while rolling back.`,
      data: { migration: metadata.name },
      debug: { id: migration.id },
      error: err as Error,
    });
  }

  await markMigrationRolledBack(client, migration.id, tableOptions);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};
