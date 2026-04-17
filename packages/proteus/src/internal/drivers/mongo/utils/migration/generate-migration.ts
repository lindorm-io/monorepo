import type { Db } from "mongodb";
import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { GenerateMigrationResult } from "../../../../interfaces/MigrationManager";
import { writeMigrationFile } from "../../../../utils/migration/write-migration-file";
import { diffIndexes } from "../sync/diff-indexes";
import { introspectIndexes } from "../sync/introspect-indexes";
import { projectDesiredIndexes } from "../sync/project-desired-indexes";
import { serializeMongoMigration } from "./serialize-mongo-migration";

export type GenerateMongoMigrationOptions = {
  name?: string;
  directory: string;
  timestamp?: Date;
  writeFile?: boolean;
};

export const generateMongoMigration = async (
  db: Db,
  metadataList: Array<EntityMetadata>,
  namespace: string | null,
  options: GenerateMongoMigrationOptions,
): Promise<GenerateMigrationResult> => {
  // 1. Project desired indexes from entity metadata
  const desired = projectDesiredIndexes(metadataList, namespace);

  // 2. Collect all referenced collection names for introspection
  const allCollections = new Set<string>();
  for (const idx of desired) {
    allCollections.add(idx.collection);
  }

  // 3. Introspect existing proteus-managed indexes
  const existing = await introspectIndexes(db, [...allCollections]);

  // 4. Determine existing collections for the diff
  const existingCollections = new Set<string>();
  for (const idx of existing) {
    existingCollections.add(idx.collection);
  }
  // Also include collections that exist but have no proteus indexes
  const dbCollections = await db.listCollections().toArray();
  for (const c of dbCollections) {
    existingCollections.add(c.name);
  }

  // 5. Diff existing vs desired
  const plan = diffIndexes(existing, desired, existingCollections);

  // 6. Serialize to migration file content
  const migration = serializeMongoMigration(plan, {
    name: options.name,
    timestamp: options.timestamp,
  });

  const totalOps =
    plan.collectionsToCreate.length +
    plan.indexesToCreate.length +
    plan.indexesToDrop.length;

  // 7. Write to disk (unless writeFile is explicitly false)
  const filepath =
    options.writeFile !== false
      ? await writeMigrationFile(options.directory, migration.filename, migration.content)
      : null;

  return {
    filepath,
    operationCount: totalOps,
    isEmpty: totalOps === 0,
  };
};
