import type { EntityMetadata } from "#internal/entity/types/metadata";
import type {
  GenerateBaselineResult,
  GenerateMigrationResult,
  IMigrationManager,
  MigrationStatusResult,
} from "#internal/interfaces/MigrationManager";
import type { NamespaceOptions } from "#internal/types/types";
import { computeHash } from "#internal/utils/migration/compute-hash";
import { loadMigrations } from "#internal/utils/migration/load-migrations";
import { resolvePending } from "#internal/utils/migration/resolve-pending";
import { validateMigrationDriver } from "#internal/utils/migration/validate-migration-driver";
import { writeMigrationFile } from "#internal/utils/migration/write-migration-file";
import type { ILogger } from "@lindorm/logger";
import { SqliteMigrationError } from "../errors/SqliteMigrationError";
import type { SqliteDbSnapshot } from "../types/db-snapshot";
import type {
  MigrationApplyResult,
  MigrationRecord,
  SqliteMigrationTableOptions,
} from "../types/migration";
import type { SqliteQueryClient } from "../types/sqlite-query-client";
import {
  executeMigrationDown,
  executeMigrationUp,
} from "../utils/migration/execute-migration";
import {
  ensureMigrationTable,
  getAllMigrationRecords,
  getAppliedMigrations,
  getPartiallyAppliedMigrations,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "../utils/migration/migration-table";
import { serializeSqliteMigration } from "../utils/migration/serialize-sqlite-migration";
import { diffSchema } from "../utils/sync/diff-schema";
import { introspectSchema } from "../utils/sync/introspect-schema";
import { projectDesiredSchemaSqlite } from "../utils/sync/project-desired-schema-sqlite";

const EMPTY_SNAPSHOT: SqliteDbSnapshot = { tables: new Map() };

export type SqliteMigrationManagerOptions = {
  client: SqliteQueryClient;
  directory: string;
  logger: ILogger;
  tableOptions?: SqliteMigrationTableOptions;
};

export class SqliteMigrationManager implements IMigrationManager {
  private readonly client: SqliteQueryClient;
  private readonly directory: string;
  private readonly logger: ILogger;
  private readonly tableOptions: SqliteMigrationTableOptions | undefined;

  public constructor(options: SqliteMigrationManagerOptions) {
    this.client = options.client;
    this.directory = options.directory;
    this.logger = options.logger;
    this.tableOptions = options.tableOptions;
  }

  public async status(): Promise<MigrationStatusResult> {
    const loaded = await loadMigrations(this.directory, this.logger);

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);

    const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

    return { resolved, ghosts };
  }

  public async apply(): Promise<MigrationApplyResult> {
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
      throw new SqliteMigrationError(
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
      throw new SqliteMigrationError("Checksum mismatch detected — aborting", {
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
      validateMigrationDriver(entry.migration, entry.name, "sqlite");
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
  }

  public async rollback(count: number = 1): Promise<MigrationApplyResult> {
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
      throw new SqliteMigrationError(
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
      throw new SqliteMigrationError(
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
  }

  public async resolveApplied(name: string, directory: string): Promise<void> {
    const logger = this.logger.child(["resolveApplied"]);
    const loaded = await loadMigrations(directory, logger);
    const match = loaded.find((l) => l.name === name);

    if (!match) {
      const available = loaded.map((l) => l.name);
      throw new SqliteMigrationError(
        `Migration file not found: ${name}. Available migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await ensureMigrationTable(this.client, this.tableOptions);
    const applied = await getAppliedMigrations(this.client, this.tableOptions);
    const alreadyApplied = applied.find((r) => r.name === name);

    if (alreadyApplied) {
      throw new SqliteMigrationError(`Migration "${name}" is already marked as applied`);
    }

    const checksum = computeHash(match.migration);
    const now = new Date();

    this.client.exec("BEGIN IMMEDIATE");
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
      this.client.exec("COMMIT");
    } catch (error) {
      try {
        this.client.exec("ROLLBACK");
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
      throw new SqliteMigrationError(
        `Migration not found in tracking table or already rolled back: ${name}. Available applied migrations: ${available.join(", ") || "(none)"}`,
      );
    }

    await markMigrationRolledBack(this.client, match.id, this.tableOptions);
  }

  public async getRecords(): Promise<Array<MigrationRecord>> {
    await ensureMigrationTable(this.client, this.tableOptions);
    return getAllMigrationRecords(this.client, this.tableOptions);
  }

  public async generateMigration(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date; writeFile?: boolean },
  ): Promise<GenerateMigrationResult> {
    const desired = projectDesiredSchemaSqlite(metadataList, namespaceOptions);
    const managedTables = desired.tables.map((t) => t.name);
    const snapshot = introspectSchema(this.client, managedTables);
    const plan = diffSchema(snapshot, desired);

    const migration = serializeSqliteMigration(plan, snapshot, {
      name: options?.name,
      timestamp: options?.timestamp,
    });

    const filepath =
      options?.writeFile !== false
        ? await writeMigrationFile(this.directory, migration.filename, migration.content)
        : null;

    return {
      filepath,
      operationCount: plan.operations.length,
      isEmpty: plan.operations.length === 0,
    };
  }

  public async generateBaseline(
    metadataList: Array<EntityMetadata>,
    namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date },
  ): Promise<GenerateBaselineResult> {
    // 1. Project desired schema from entity metadata
    const desired = projectDesiredSchemaSqlite(metadataList, namespaceOptions);

    // 2. Diff against empty snapshot — captures full schema creation
    const plan = diffSchema(EMPTY_SNAPSHOT, desired);

    // 3. Serialize to migration file content
    const migration = serializeSqliteMigration(plan, EMPTY_SNAPSHOT, {
      name: options?.name ?? "baseline",
      timestamp: options?.timestamp,
    });

    // 4. Introspect live DB to check if schema already matches
    const managedTables = desired.tables.map((t) => t.name);
    const liveSnapshot = introspectSchema(this.client, managedTables);
    const liveDiff = diffSchema(liveSnapshot, desired);

    // 5. Write to disk
    const filepath = await writeMigrationFile(
      this.directory,
      migration.filename,
      migration.content,
    );

    // 6. If live DB matches desired, mark baseline as applied without executing
    let markedAsApplied = false;

    if (liveDiff.operations.length === 0) {
      // Load the written file back and compute checksum from the actual module
      // to ensure it matches what apply-time will compute via computeHash
      const loaded = await loadMigrations(this.directory, this.logger);
      const baselineEntry = loaded.find((l) => l.migration.id === migration.id);
      const checksum = baselineEntry
        ? computeHash(baselineEntry.migration)
        : migration.checksum;

      await ensureMigrationTable(this.client, this.tableOptions);

      this.client.exec("BEGIN IMMEDIATE");
      try {
        await insertMigrationRecord(
          this.client,
          {
            id: migration.id,
            name: migration.filename.replace(/\.ts$/, ""),
            checksum,
            createdAt: new Date(migration.ts),
            startedAt: new Date(),
          },
          this.tableOptions,
        );
        await markMigrationFinished(this.client, migration.id, this.tableOptions);
        this.client.exec("COMMIT");
      } catch (error) {
        try {
          this.client.exec("ROLLBACK");
        } catch {
          /* preserve original */
        }
        throw error;
      }

      markedAsApplied = true;
    }

    return {
      filepath,
      operationCount: plan.operations.length,
      markedAsApplied,
    };
  }
}
