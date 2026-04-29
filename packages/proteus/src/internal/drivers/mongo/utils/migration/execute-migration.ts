import type { Db } from "mongodb";
import type { MigrationInterfaceShape } from "../../../../utils/migration/resolve-pending.js";
import { MongoMigrationError } from "../../errors/MongoMigrationError.js";
import {
  ensureMigrationCollection,
  insertMigrationRecord,
  markMigrationFailed,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-tracking.js";
import { createMongoMigrationRunner } from "./mongo-migration-runner.js";

export type ExecuteMigrationResult = {
  name: string;
  durationMs: number;
};

export const executeMigrationUp = async (
  db: Db,
  migration: MigrationInterfaceShape,
  metadata: { name: string; checksum: string },
  isReplicaSet: boolean,
  tableName?: string,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationCollection(db, tableName);

  const startedAt = Date.now();

  await insertMigrationRecord(
    db,
    {
      id: migration.id,
      name: metadata.name,
      checksum: metadata.checksum,
      createdAt: new Date(migration.ts),
      startedAt: new Date(startedAt),
    },
    tableName,
  );

  const runner = createMongoMigrationRunner(db, isReplicaSet);

  try {
    await migration.up(runner);
  } catch (err) {
    // Mark as failed so the record persists for crash detection
    try {
      await markMigrationFailed(db, migration.id, tableName);
    } catch {
      // Mark-failed failure is secondary — preserve the original error
    }
    throw new MongoMigrationError("Migration up() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationFinished(db, migration.id, tableName);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};

export const executeMigrationDown = async (
  db: Db,
  migration: MigrationInterfaceShape,
  metadata: { name: string },
  isReplicaSet: boolean,
  tableName?: string,
): Promise<ExecuteMigrationResult> => {
  await ensureMigrationCollection(db, tableName);

  const startedAt = Date.now();
  const runner = createMongoMigrationRunner(db, isReplicaSet);

  try {
    await migration.down(runner);
  } catch (err) {
    throw new MongoMigrationError("Migration down() failed", {
      debug: { id: migration.id, name: metadata.name },
      error: err as Error,
    });
  }

  await markMigrationRolledBack(db, migration.id, tableName);

  const durationMs = Date.now() - startedAt;
  return { name: metadata.name, durationMs };
};
