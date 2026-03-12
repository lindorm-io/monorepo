import type { EntityMetadata } from "#internal/entity/types/metadata";
import type {
  IMigrationManager,
  MigrationStatusResult,
} from "#internal/interfaces/MigrationManager";
import type { NamespaceOptions } from "#internal/types/types";
import { hashNamespaceToInt32 } from "#internal/utils/advisory-lock-name";
import { computeHash } from "#internal/utils/migration/compute-hash";
import { validateMigrationDriver } from "#internal/utils/migration/validate-migration-driver";
import type { ILogger } from "@lindorm/logger";
import { PostgresMigrationError } from "../errors/PostgresMigrationError";
import type { MigrationApplyResult, MigrationTableOptions } from "../types/migration";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { withAdvisoryLock } from "../utils/advisory-lock";
import {
  executeMigrationDown,
  executeMigrationUp,
} from "../utils/migration/execute-migration";
import {
  generateBaselineMigration,
  type GenerateBaselineMigrationOptions,
  type GenerateBaselineMigrationResult,
} from "../utils/migration/generate-baseline-migration";
import {
  generateMigration,
  type GenerateMigrationOptions,
  type GenerateMigrationResult,
} from "../utils/migration/generate-migration";
import { loadMigrations } from "../utils/migration/load-migrations";
import {
  ensureMigrationTable,
  getAllMigrationRecords,
  getAppliedMigrations,
  getPartiallyAppliedMigrations,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "../utils/migration/migration-table";
import { resolvePending } from "../utils/migration/resolve-pending";

// Advisory lock key pair for migration operations (distinct from sync key)
const MIGRATION_LOCK_KEY1 = 0x50524f54; // "PROT" in hex

export type MigrationManagerOptions = {
  client: PostgresQueryClient;
  directory: string;
  logger: ILogger;
  namespace?: string | null;
  tableOptions?: MigrationTableOptions;
};

export class MigrationManager implements IMigrationManager {
  private readonly client: PostgresQueryClient;
  private readonly directory: string;
  private readonly logger: ILogger;
  private readonly tableOptions: MigrationTableOptions | undefined;
  private readonly lockKey2: number;

  public constructor(options: MigrationManagerOptions) {
    this.client = options.client;
    this.directory = options.directory;
    this.logger = options.logger;
    this.tableOptions = options.tableOptions;
    // XOR the fixed "MIGR" marker with a namespace hash to isolate per-namespace
    this.lockKey2 = 0x4d494752 ^ hashNamespaceToInt32(options.namespace ?? null);
  }

  public async status(): Promise<MigrationStatusResult> {
    const loaded = await loadMigrations(this.directory, this.logger);

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);

    const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

    return { resolved, ghosts };
  }

  public async apply(): Promise<MigrationApplyResult> {
    const result = await withAdvisoryLock(
      this.client,
      MIGRATION_LOCK_KEY1,
      this.lockKey2,
      async () => {
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
          throw new PostgresMigrationError(
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
          throw new PostgresMigrationError("Checksum mismatch detected — aborting", {
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
          validateMigrationDriver(entry.migration, entry.name, "postgres");
        }

        const results: Array<{ name: string; durationMs: number }> = [];

        for (const entry of pending) {
          const checksum = computeHash(entry.migration);
          const r = await executeMigrationUp(
            this.client,
            entry.migration,
            { name: entry.name, checksum },
            this.tableOptions,
          );
          results.push(r);
        }

        return {
          applied: results,
          skipped: resolved.length - pending.length,
        };
      },
    );

    if (result === null) {
      throw new PostgresMigrationError("Could not acquire migration advisory lock");
    }

    return result;
  }

  public async rollback(count: number = 1): Promise<MigrationApplyResult> {
    const result = await withAdvisoryLock(
      this.client,
      MIGRATION_LOCK_KEY1,
      this.lockKey2,
      async () => {
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
          throw new PostgresMigrationError(
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
          throw new PostgresMigrationError(
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
          );
          results.push(r);
        }

        return {
          applied: results,
          skipped: Math.max(0, count - appliedEntries.length),
        };
      },
    );

    if (result === null) {
      throw new PostgresMigrationError("Could not acquire migration advisory lock");
    }

    return result;
  }

  public async generateBaseline(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: Partial<
      Pick<GenerateBaselineMigrationOptions, "name" | "timestamp" | "tableOptions">
    >,
  ): Promise<GenerateBaselineMigrationResult> {
    const result = await withAdvisoryLock(
      this.client,
      MIGRATION_LOCK_KEY1,
      this.lockKey2,
      async () =>
        generateBaselineMigration(this.client, metadataList, namespaceOptions, {
          ...options,
          directory: this.directory,
          tableOptions: options?.tableOptions ?? this.tableOptions,
          logger: this.logger,
        }),
    );

    if (result === null) {
      throw new PostgresMigrationError("Could not acquire migration advisory lock");
    }

    return result;
  }

  public async generateMigration(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: Partial<Pick<GenerateMigrationOptions, "name" | "timestamp" | "writeFile">>,
  ): Promise<GenerateMigrationResult> {
    const result = await withAdvisoryLock(
      this.client,
      MIGRATION_LOCK_KEY1,
      this.lockKey2,
      async () =>
        generateMigration(this.client, metadataList, namespaceOptions, {
          ...options,
          directory: this.directory,
        }),
    );

    if (result === null) {
      throw new PostgresMigrationError("Could not acquire migration advisory lock");
    }

    return result;
  }

  public async resolveApplied(name: string, directory: string): Promise<void> {
    const logger = this.logger.child(["resolveApplied"]);
    const loaded = await loadMigrations(directory, logger);
    const match = loaded.find((l) => l.name === name);

    if (!match) {
      const available = loaded.map((l) => l.name);
      throw new PostgresMigrationError(
        `Migration file not found: ${name}. Available migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);
    const alreadyApplied = applied.find((r) => r.name === name);

    if (alreadyApplied) {
      throw new PostgresMigrationError(
        `Migration "${name}" is already marked as applied`,
      );
    }

    const checksum = computeHash(match.migration);
    const now = new Date();

    await this.client.query("BEGIN");
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
      throw new PostgresMigrationError(
        `Migration not found in tracking table or already rolled back: ${name}. Available applied migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await markMigrationRolledBack(this.client, match.id, this.tableOptions);
  }

  public async getRecords() {
    await ensureMigrationTable(this.client, this.tableOptions);
    return getAllMigrationRecords(this.client, this.tableOptions);
  }
}
