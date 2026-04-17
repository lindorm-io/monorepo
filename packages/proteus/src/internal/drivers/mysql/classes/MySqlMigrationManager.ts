import type { EntityMetadata } from "../../../entity/types/metadata";
import type {
  GenerateBaselineResult,
  GenerateMigrationResult,
  IMigrationManager,
  MigrationStatusResult,
} from "../../../interfaces/MigrationManager";
import type { NamespaceOptions } from "../../../types/types";
import { buildMysqlLockName } from "../../../utils/advisory-lock-name";
import { computeHash } from "../../../utils/migration/compute-hash";
import { loadMigrations } from "../../../utils/migration/load-migrations";
import { resolvePending } from "../../../utils/migration/resolve-pending";
import { validateMigrationDriver } from "../../../utils/migration/validate-migration-driver";
import type { ILogger } from "@lindorm/logger";
import { MySqlMigrationError } from "../errors/MySqlMigrationError";
import type {
  MigrationApplyResult,
  MigrationRecord,
  MysqlMigrationTableOptions,
} from "../types/migration";
import type { MysqlQueryClient } from "../types/mysql-query-client";
import {
  executeMigrationDown,
  executeMigrationUp,
} from "../utils/migration/execute-migration";
import { generateMysqlBaselineMigration } from "../utils/migration/generate-baseline-migration";
import { generateMysqlMigration } from "../utils/migration/generate-migration";
import {
  ensureMigrationTable,
  getAllMigrationRecords,
  getAppliedMigrations,
  getPartiallyAppliedMigrations,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "../utils/migration/migration-table";

export type MySqlMigrationManagerOptions = {
  client: MysqlQueryClient;
  directory: string;
  logger: ILogger;
  namespace?: string | null;
  tableOptions?: MysqlMigrationTableOptions;
};

export class MySqlMigrationManager implements IMigrationManager {
  private readonly client: MysqlQueryClient;
  private readonly directory: string;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly tableOptions: MysqlMigrationTableOptions | undefined;
  private readonly lockName: string;

  public constructor(options: MySqlMigrationManagerOptions) {
    this.client = options.client;
    this.directory = options.directory;
    this.logger = options.logger;
    this.namespace = options.namespace ?? null;
    this.tableOptions = options.tableOptions;
    this.lockName = buildMysqlLockName("proteus_migration_gen", this.namespace);
  }

  private async acquireLock(): Promise<boolean> {
    const { rows } = await this.client.query<{ lock_result: number | null }>(
      `SELECT GET_LOCK(?, 30) AS lock_result`,
      [this.lockName],
    );
    return rows[0]?.lock_result === 1;
  }

  private async releaseLock(): Promise<void> {
    try {
      await this.client.query(`SELECT RELEASE_LOCK(?)`, [this.lockName]);
    } catch {
      // Best effort — lock will expire on session close
    }
  }

  public async status(): Promise<MigrationStatusResult> {
    const loaded = await loadMigrations(this.directory, this.logger);

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);

    const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

    return { resolved, ghosts };
  }

  public async apply(): Promise<MigrationApplyResult> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new MySqlMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      const loaded = await loadMigrations(this.directory, this.logger);

      await ensureMigrationTable(this.client, this.tableOptions);
      const applied = await getAppliedMigrations(this.client, this.tableOptions);
      const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

      if (ghosts.length > 0) {
        this.logger.warn(
          "Ghost migrations detected — applied to DB but source files missing",
          {
            ghosts: ghosts.map((g) => ({ id: g.id, name: g.name })),
          },
        );
      }

      // Detect partially-applied migrations (started but not finished — likely a crash)
      const partiallyApplied = await getPartiallyAppliedMigrations(
        this.client,
        this.tableOptions,
      );
      if (partiallyApplied.length > 0) {
        throw new MySqlMigrationError(
          "Partially applied migrations detected — these started but never finished (possible crash). " +
            "Manual intervention required: delete the record to retry, or mark finished if the DDL landed.",
          {
            debug: {
              partiallyApplied: partiallyApplied.map((r) => ({
                id: r.id,
                name: r.name,
                startedAt: r.startedAt,
              })),
            },
          },
        );
      }

      const pending = resolved.filter((r) => r.status === "pending");
      const mismatched = resolved.filter((r) => r.status === "checksum_mismatch");

      if (mismatched.length > 0) {
        throw new MySqlMigrationError("Checksum mismatch detected — aborting", {
          debug: {
            mismatched: mismatched.map((m) => ({
              id: m.migration.id,
              name: m.name,
            })),
          },
        });
      }

      // Validate driver field before executing
      for (const entry of pending) {
        validateMigrationDriver(entry.migration, entry.name, "mysql");
      }

      const results: Array<{ name: string; durationMs: number }> = [];

      for (const entry of pending) {
        const checksum = computeHash(entry.migration);
        const r = await executeMigrationUp(
          this.client,
          entry.migration,
          { name: entry.name, checksum },
          this.tableOptions,
          this.namespace,
        );
        results.push(r);
      }

      return {
        applied: results,
        skipped: resolved.length - pending.length,
      };
    } finally {
      await this.releaseLock();
    }
  }

  public async rollback(count: number = 1): Promise<MigrationApplyResult> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new MySqlMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      const loaded = await loadMigrations(this.directory, this.logger);

      await ensureMigrationTable(this.client, this.tableOptions);
      const applied = await getAppliedMigrations(this.client, this.tableOptions);
      const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

      if (ghosts.length > 0) {
        this.logger.warn(
          "Ghost migrations detected — applied to DB but source files missing",
          {
            ghosts: ghosts.map((g) => ({ id: g.id, name: g.name })),
          },
        );
      }

      // Detect partially-applied migrations
      const partiallyApplied = await getPartiallyAppliedMigrations(
        this.client,
        this.tableOptions,
      );
      if (partiallyApplied.length > 0) {
        throw new MySqlMigrationError(
          "Partially applied migrations detected — these started but never finished (possible crash). " +
            "Manual intervention required: delete the record to retry, or mark finished if the DDL landed.",
          {
            debug: {
              partiallyApplied: partiallyApplied.map((r) => ({
                id: r.id,
                name: r.name,
                startedAt: r.startedAt,
              })),
            },
          },
        );
      }

      const mismatched = resolved.filter((r) => r.status === "checksum_mismatch");
      if (mismatched.length > 0) {
        throw new MySqlMigrationError(
          "Checksum mismatch detected — cannot safely rollback",
          {
            debug: {
              mismatched: mismatched.map((m) => ({
                id: m.migration.id,
                name: m.name,
              })),
            },
          },
        );
      }

      // Roll back in reverse order — most recently applied first
      const appliedEntries = resolved
        .filter((r) => r.status === "applied")
        .reverse()
        .slice(0, count);

      if (appliedEntries.length === 0) {
        return { applied: [], skipped: 0 };
      }

      const results: Array<{ name: string; durationMs: number }> = [];

      for (const entry of appliedEntries) {
        const r = await executeMigrationDown(
          this.client,
          entry.migration,
          { name: entry.name },
          this.tableOptions,
          this.namespace,
        );
        results.push(r);
      }

      return {
        applied: results,
        skipped: Math.max(0, count - appliedEntries.length),
      };
    } finally {
      await this.releaseLock();
    }
  }

  public async generateMigration(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date; writeFile?: boolean },
  ): Promise<GenerateMigrationResult> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new MySqlMigrationError("Could not acquire migration advisory lock");
    }

    try {
      return await generateMysqlMigration(this.client, metadataList, namespaceOptions, {
        ...options,
        directory: this.directory,
      });
    } finally {
      await this.releaseLock();
    }
  }

  public async generateBaseline(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date },
  ): Promise<GenerateBaselineResult> {
    const lockAcquired = await this.acquireLock();
    if (!lockAcquired) {
      throw new MySqlMigrationError("Could not acquire migration advisory lock");
    }

    try {
      return await generateMysqlBaselineMigration(
        this.client,
        metadataList,
        namespaceOptions,
        {
          ...options,
          directory: this.directory,
          tableOptions: this.tableOptions,
          logger: this.logger,
        },
      );
    } finally {
      await this.releaseLock();
    }
  }

  public async resolveApplied(name: string, directory: string): Promise<void> {
    const logger = this.logger.child(["resolveApplied"]);
    const loaded = await loadMigrations(directory, logger);
    const match = loaded.find((l) => l.name === name);

    if (!match) {
      const available = loaded.map((l) => l.name);
      throw new MySqlMigrationError(
        `Migration file not found: ${name}. Available migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);
    const alreadyApplied = applied.find((r) => r.name === name);

    if (alreadyApplied) {
      throw new MySqlMigrationError(`Migration "${name}" is already marked as applied`);
    }

    const checksum = computeHash(match.migration);
    const now = new Date();

    await this.client.query("START TRANSACTION");
    try {
      await insertMigrationRecord(
        this.client,
        {
          id: match.migration.id,
          name: match.name,
          checksum,
          createdAt: now,
          startedAt: now,
        },
        this.tableOptions,
      );
      await markMigrationFinished(this.client, match.migration.id, this.tableOptions);
      await this.client.query("COMMIT");
    } catch (error) {
      try {
        await this.client.query("ROLLBACK");
      } catch {
        /* preserve original */
      }
      throw error;
    }
  }

  public async resolveRolledBack(name: string): Promise<void> {
    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);
    const match = applied.find((r) => r.name === name);

    if (!match) {
      const available = applied.map((r) => r.name);
      throw new MySqlMigrationError(
        `Migration not found in tracking table or already rolled back: ${name}. Available applied migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await markMigrationRolledBack(this.client, match.id, this.tableOptions);
  }

  public async getRecords(): Promise<Array<MigrationRecord>> {
    await ensureMigrationTable(this.client, this.tableOptions);
    return getAllMigrationRecords(this.client, this.tableOptions);
  }
}
