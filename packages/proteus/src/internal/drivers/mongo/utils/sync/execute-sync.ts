import type { Db, CreateIndexesOptions, IndexSpecification } from "mongodb";
import type { ILogger } from "@lindorm/logger";
import type { MongoSyncPlan, DesiredMongoIndex } from "./types.js";

/**
 * Build MongoDB createIndex options from a desired index spec.
 */
const buildCreateIndexOptions = (idx: DesiredMongoIndex): CreateIndexesOptions => {
  const options: CreateIndexesOptions = {
    name: idx.name,
  };

  if (idx.unique) options.unique = true;
  if (idx.sparse) options.sparse = true;
  if (idx.expireAfterSeconds != null) options.expireAfterSeconds = idx.expireAfterSeconds;

  return options;
};

/**
 * Execute a MongoDB sync plan.
 *
 * - Creates collections that don't exist yet (idempotent via createCollection).
 * - Drops indexes that are no longer needed or have changed.
 * - Creates new or changed indexes.
 *
 * Index operations cannot run inside MongoDB transactions — all operations
 * run outside transactions against the Db directly.
 *
 * If `options.dryRun` is true, logs planned changes without executing them.
 */
export const executeSync = async (
  db: Db,
  plan: MongoSyncPlan,
  logger: ILogger,
  options?: { dryRun?: boolean },
): Promise<void> => {
  const dryRun = options?.dryRun ?? false;

  const totalOps =
    plan.collectionsToCreate.length +
    plan.indexesToDrop.length +
    plan.indexesToCreate.length;
  if (totalOps === 0) {
    logger.debug("MongoDB sync: no changes needed");
    return;
  }

  logger.info(`MongoDB sync: ${totalOps} operations planned`, {
    collections: plan.collectionsToCreate.length,
    drop: plan.indexesToDrop.length,
    create: plan.indexesToCreate.length,
    dryRun,
  });

  // Create collections
  for (const collName of plan.collectionsToCreate) {
    if (dryRun) {
      logger.info(`[DRY RUN] Create collection: ${collName}`);
      continue;
    }

    try {
      await db.createCollection(collName);
      logger.debug(`Created collection: ${collName}`);
    } catch (error: any) {
      // Collection already exists — idempotent
      if (error?.codeName === "NamespaceExists" || error?.code === 48) {
        logger.debug(`Collection already exists: ${collName}`);
      } else {
        throw error;
      }
    }
  }

  // Drop indexes
  for (const { collection, name } of plan.indexesToDrop) {
    if (dryRun) {
      logger.info(`[DRY RUN] Drop index: ${name} from ${collection}`);
      continue;
    }

    try {
      await db.collection(collection).dropIndex(name);
      logger.debug(`Dropped index: ${name} from ${collection}`);
    } catch (error: any) {
      // Index doesn't exist — idempotent
      if (error?.codeName === "IndexNotFound" || error?.code === 27) {
        logger.debug(`Index not found (already dropped): ${name} from ${collection}`);
      } else {
        throw error;
      }
    }
  }

  // Create indexes
  for (const idx of plan.indexesToCreate) {
    if (dryRun) {
      logger.info(`[DRY RUN] Create index: ${idx.name} on ${idx.collection}`, {
        keys: idx.keys,
        unique: idx.unique,
        sparse: idx.sparse,
        expireAfterSeconds: idx.expireAfterSeconds,
      });
      continue;
    }

    const collection = db.collection(idx.collection);
    const indexSpec = idx.keys as IndexSpecification;
    const indexOptions = buildCreateIndexOptions(idx);

    try {
      await collection.createIndex(indexSpec, indexOptions);
      logger.debug(`Created index: ${idx.name} on ${idx.collection}`, {
        keys: idx.keys,
        unique: idx.unique,
      });
    } catch (error: any) {
      // IndexOptionsConflict (code 85) or an existing index with the same name
      // but different options — log and continue for idempotency
      if (error?.code === 85 || error?.codeName === "IndexOptionsConflict") {
        logger.warn(
          `Index options conflict (idempotent skip): ${idx.name} on ${idx.collection}`,
          {
            keys: idx.keys,
            error: error.message,
          },
        );
      } else {
        throw error;
      }
    }
  }
};
