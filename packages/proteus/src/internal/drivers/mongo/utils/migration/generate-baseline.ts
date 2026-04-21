import type { Db } from "mongodb";
import type { ILogger } from "@lindorm/logger";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { GenerateBaselineResult } from "../../../../interfaces/MigrationManager.js";
import { computeHash } from "../../../../utils/migration/compute-hash.js";
import { loadMigrations } from "../../../../utils/migration/load-migrations.js";
import { writeMigrationFile } from "../../../../utils/migration/write-migration-file.js";
import { diffIndexes } from "../sync/diff-indexes.js";
import { introspectIndexes } from "../sync/introspect-indexes.js";
import { projectDesiredIndexes } from "../sync/project-desired-indexes.js";
import {
  ensureMigrationCollection,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-tracking.js";
import { serializeMongoMigration } from "./serialize-mongo-migration.js";

export type GenerateMongoBaselineOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  tableName?: string;
  logger?: ILogger;
};

export const generateMongoBaseline = async (
  db: Db,
  metadataList: Array<EntityMetadata>,
  namespace: string | null,
  options: GenerateMongoBaselineOptions,
): Promise<GenerateBaselineResult> => {
  // 1. Project desired indexes from entity metadata
  const desired = projectDesiredIndexes(metadataList, namespace);

  // 2. Diff against empty state — captures all indexes as "new"
  const emptyExisting = new Set<string>();
  const plan = diffIndexes([], desired, emptyExisting);

  // 3. Serialize to migration file content
  const migration = serializeMongoMigration(plan, {
    name: options.name ?? "baseline",
    timestamp: options.timestamp,
  });

  // 4. Introspect live DB to check if state already matches
  const allCollections = new Set<string>();
  for (const idx of desired) {
    allCollections.add(idx.collection);
  }
  const liveExisting = await introspectIndexes(db, [...allCollections]);
  const liveExistingCollections = new Set<string>();
  for (const idx of liveExisting) {
    liveExistingCollections.add(idx.collection);
  }
  const dbCollections = await db.listCollections().toArray();
  for (const c of dbCollections) {
    liveExistingCollections.add(c.name);
  }
  const liveDiff = diffIndexes(liveExisting, desired, liveExistingCollections);
  const liveOps =
    liveDiff.collectionsToCreate.length +
    liveDiff.indexesToCreate.length +
    liveDiff.indexesToDrop.length;

  // 5. Write to disk
  const filepath = await writeMigrationFile(
    options.directory,
    migration.filename,
    migration.content,
  );

  // 6. If live DB matches desired, mark as applied without executing
  let markedAsApplied = false;

  if (liveOps === 0) {
    // Load the written file back and compute checksum from the actual module
    const loaded = options.logger
      ? await loadMigrations(options.directory, options.logger)
      : [];
    const baselineEntry = loaded.find((l) => l.migration.id === migration.id);
    const checksum = baselineEntry
      ? computeHash(baselineEntry.migration)
      : migration.checksum;

    await ensureMigrationCollection(db, options.tableName);

    await insertMigrationRecord(
      db,
      {
        id: migration.id,
        name: migration.filename.replace(/\.ts$/, ""),
        checksum,
        createdAt: new Date(migration.ts),
        startedAt: new Date(),
      },
      options.tableName,
    );
    await markMigrationFinished(db, migration.id, options.tableName);

    markedAsApplied = true;
  }

  const totalOps =
    plan.collectionsToCreate.length +
    plan.indexesToCreate.length +
    plan.indexesToDrop.length;

  return {
    filepath,
    operationCount: totalOps,
    markedAsApplied,
  };
};
