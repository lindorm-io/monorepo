import { isEqual } from "@lindorm/is";
import type { DesiredMongoIndex, ExistingMongoIndex, MongoSyncPlan } from "./types.js";

/**
 * Compare an existing index with a desired index to determine if they match.
 *
 * Matches on: keys (field names + directions), unique flag, sparse flag, and TTL config.
 */
const indexMatches = (
  existing: ExistingMongoIndex,
  desired: DesiredMongoIndex,
): boolean => {
  if (existing.unique !== desired.unique) return false;
  if (existing.sparse !== desired.sparse) return false;
  if (existing.expireAfterSeconds !== desired.expireAfterSeconds) return false;
  if (!isEqual(existing.keys, desired.keys)) return false;
  return true;
};

/**
 * Diff existing indexes against desired indexes to produce a sync plan.
 *
 * - Indexes matched by name: if keys/options differ, drop old + create new.
 * - Indexes in desired but not existing: create.
 * - Indexes in existing but not desired: drop.
 * - Collections that need to be created are determined from desired indexes referencing
 *   collections not in the existing set.
 */
export const diffIndexes = (
  existing: Array<ExistingMongoIndex>,
  desired: Array<DesiredMongoIndex>,
  existingCollections: Set<string>,
): MongoSyncPlan => {
  const indexesToCreate: Array<DesiredMongoIndex> = [];
  const indexesToDrop: Array<{ collection: string; name: string }> = [];

  // Build lookup maps
  const existingByName = new Map<string, ExistingMongoIndex>();
  for (const idx of existing) {
    existingByName.set(`${idx.collection}::${idx.name}`, idx);
  }

  const desiredByName = new Map<string, DesiredMongoIndex>();
  for (const idx of desired) {
    desiredByName.set(`${idx.collection}::${idx.name}`, idx);
  }

  // Drop indexes that no longer exist or have changed
  for (const [key, existingIdx] of existingByName) {
    const desiredIdx = desiredByName.get(key);

    if (!desiredIdx || !indexMatches(existingIdx, desiredIdx)) {
      indexesToDrop.push({
        collection: existingIdx.collection,
        name: existingIdx.name,
      });
    }
  }

  // Create indexes that are new or were dropped above (changed)
  for (const [key, desiredIdx] of desiredByName) {
    const existingIdx = existingByName.get(key);

    if (existingIdx && indexMatches(existingIdx, desiredIdx)) continue;

    indexesToCreate.push(desiredIdx);
  }

  // Determine collections that need to be created
  const desiredCollections = new Set<string>();
  for (const idx of desired) {
    desiredCollections.add(idx.collection);
  }

  const collectionsToCreate: Array<string> = [];
  for (const coll of desiredCollections) {
    if (!existingCollections.has(coll)) {
      collectionsToCreate.push(coll);
    }
  }

  return {
    collectionsToCreate,
    indexesToCreate,
    indexesToDrop,
  };
};
