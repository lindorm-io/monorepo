import type { Db, MongoClient } from "mongodb";
import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type {
  GenerateBaselineResult,
  GenerateMigrationResult,
  IMigrationManager,
  MigrationStatusResult,
} from "../../../interfaces/MigrationManager";
import type { MigrationApplyResult, MigrationRecord } from "../../../types/migration";
import type { NamespaceOptions } from "../../../types/types";
import { computeHash } from "../../../utils/migration/compute-hash";
import { loadMigrations } from "../../../utils/migration/load-migrations";
import { resolvePending } from "../../../utils/migration/resolve-pending";
import { validateMigrationDriver } from "../../../utils/migration/validate-migration-driver";
import { MongoMigrationError } from "../errors/MongoMigrationError";
import { detectReplicaSet } from "../utils/detect-replica-set";
import { acquireLock, releaseLock } from "../utils/migration/advisory-lock";
import {
  executeMigrationDown,
  executeMigrationUp,
} from "../utils/migration/execute-migration";
import { generateMongoBaseline } from "../utils/migration/generate-baseline";
import { generateMongoMigration } from "../utils/migration/generate-migration";
import {
  ensureMigrationCollection,
  getAllMigrationRecords,
  getAppliedMigrations,
  getPartiallyAppliedMigrations,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "../utils/migration/migration-tracking";

export type MongoMigrationManagerOptions = {
  client: MongoClient;
  db: Db;
  directory: string;
  logger: ILogger;
  namespace: string | null;
  isReplicaSet?: boolean;
  tableName?: string;
};

export class MongoMigrationManager implements IMigrationManager {
  private readonly client: MongoClient;
  private readonly db: Db;
  private readonly directory: string;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly tableName: string | undefined;
  private cachedIsReplicaSet: boolean | null;

  public constructor(options: MongoMigrationManagerOptions) {
    this.client = options.client;
    this.db = options.db;
    this.directory = options.directory;
    this.logger = options.logger;
    this.namespace = options.namespace;
    this.tableName = options.tableName;
    this.cachedIsReplicaSet = options.isReplicaSet ?? null;
  }

  private async resolveIsReplicaSet(): Promise<boolean> {
    if (this.cachedIsReplicaSet !== null) return this.cachedIsReplicaSet;
    this.cachedIsReplicaSet = await detectReplicaSet(this.db.admin());
    return this.cachedIsReplicaSet;
  }

  public async status(): Promise<MigrationStatusResult> {
    const loaded = await loadMigrations(this.directory, this.logger);

    await ensureMigrationCollection(this.db, this.tableName);
    const applied = await getAppliedMigrations(this.db, this.tableName);

    const { resolved, ghosts } = resolvePending(loaded, applied, computeHash);

    return { resolved, ghosts };
  }

  public async apply(): Promise<MigrationApplyResult> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      const loaded = await loadMigrations(this.directory, this.logger);

      await ensureMigrationCollection(this.db, this.tableName);
      const applied = await getAppliedMigrations(this.db, this.tableName);
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
        this.db,
        this.tableName,
      );
      if (partiallyApplied.length > 0) {
        throw new MongoMigrationError(
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
        throw new MongoMigrationError("Checksum mismatch detected — aborting", {
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
        validateMigrationDriver(entry.migration, entry.name, "mongo");
      }

      const isReplicaSet = await this.resolveIsReplicaSet();
      const results: Array<{ name: string; durationMs: number }> = [];

      for (const entry of pending) {
        const checksum = computeHash(entry.migration);
        const r = await executeMigrationUp(
          this.db,
          entry.migration,
          { name: entry.name, checksum },
          isReplicaSet,
          this.tableName,
        );
        results.push(r);
      }

      return {
        applied: results,
        skipped: resolved.length - pending.length,
      };
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async rollback(count: number = 1): Promise<MigrationApplyResult> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      const loaded = await loadMigrations(this.directory, this.logger);

      await ensureMigrationCollection(this.db, this.tableName);
      const applied = await getAppliedMigrations(this.db, this.tableName);
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
        this.db,
        this.tableName,
      );
      if (partiallyApplied.length > 0) {
        throw new MongoMigrationError(
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
        throw new MongoMigrationError(
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

      const isReplicaSet = await this.resolveIsReplicaSet();
      const results: Array<{ name: string; durationMs: number }> = [];

      for (const entry of appliedEntries) {
        const r = await executeMigrationDown(
          this.db,
          entry.migration,
          { name: entry.name },
          isReplicaSet,
          this.tableName,
        );
        results.push(r);
      }

      return {
        applied: results,
        skipped: Math.max(0, count - appliedEntries.length),
      };
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async generateMigration(
    metadataList: Array<EntityMetadata>,
    _namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date; writeFile?: boolean },
  ): Promise<GenerateMigrationResult> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError("Could not acquire migration advisory lock");
    }

    try {
      return await generateMongoMigration(this.db, metadataList, this.namespace, {
        ...options,
        directory: this.directory,
      });
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async generateBaseline(
    metadataList: Array<EntityMetadata>,
    _namespaceOptions: NamespaceOptions,
    options?: { name?: string; timestamp?: Date },
  ): Promise<GenerateBaselineResult> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError("Could not acquire migration advisory lock");
    }

    try {
      return await generateMongoBaseline(this.db, metadataList, this.namespace, {
        ...options,
        directory: this.directory,
        tableName: this.tableName,
        logger: this.logger,
      });
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async resolveApplied(name: string, directory: string): Promise<void> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      const logger = this.logger.child(["resolveApplied"]);
      const loaded = await loadMigrations(directory, logger);
      const match = loaded.find((l) => l.name === name);

      if (!match) {
        const available = loaded.map((l) => l.name);
        throw new MongoMigrationError(
          `Migration file not found: ${name}. Available migrations: ${available.join(", ") || "(none)"}`,
        );
      }

      await ensureMigrationCollection(this.db, this.tableName);
      const applied = await getAppliedMigrations(this.db, this.tableName);
      const alreadyApplied = applied.find((r) => r.name === name);

      if (alreadyApplied) {
        throw new MongoMigrationError(`Migration "${name}" is already marked as applied`);
      }

      const checksum = computeHash(match.migration);
      const now = new Date();

      const isReplicaSet = await this.resolveIsReplicaSet();

      if (isReplicaSet) {
        const session = this.client.startSession();

        try {
          await session.withTransaction(async () => {
            await insertMigrationRecord(
              this.db,
              {
                id: match.migration.id,
                name: match.name,
                checksum,
                createdAt: now,
                startedAt: now,
              },
              this.tableName,
              session,
            );
            await markMigrationFinished(
              this.db,
              match.migration.id,
              this.tableName,
              session,
            );
          });
        } finally {
          await session.endSession();
        }
      } else {
        this.logger.warn("Standalone MongoDB: resolveApplied is not atomic");

        await insertMigrationRecord(
          this.db,
          {
            id: match.migration.id,
            name: match.name,
            checksum,
            createdAt: now,
            startedAt: now,
          },
          this.tableName,
        );
        await markMigrationFinished(this.db, match.migration.id, this.tableName);
      }
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async resolveRolledBack(name: string): Promise<void> {
    const lockAcquired = await acquireLock(this.db, this.namespace);
    if (!lockAcquired) {
      throw new MongoMigrationError(
        "Could not acquire migration advisory lock — another migration is running",
      );
    }

    try {
      await ensureMigrationCollection(this.db, this.tableName);
      const applied = await getAppliedMigrations(this.db, this.tableName);
      const match = applied.find((r) => r.name === name);

      if (!match) {
        const available = applied.map((r) => r.name);
        throw new MongoMigrationError(
          `Migration not found in tracking collection or already rolled back: ${name}. Available applied migrations: ${available.join(", ") || "(none)"}`,
        );
      }

      await markMigrationRolledBack(this.db, match.id, this.tableName);
    } finally {
      await releaseLock(this.db, this.namespace);
    }
  }

  public async getRecords(): Promise<Array<MigrationRecord>> {
    await ensureMigrationCollection(this.db, this.tableName);
    return getAllMigrationRecords(this.db, this.tableName);
  }
}
