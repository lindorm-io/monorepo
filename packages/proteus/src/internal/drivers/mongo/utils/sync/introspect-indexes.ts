import type { Db } from "mongodb";
import type { ExistingMongoIndex } from "./types";

const MANAGED_PREFIXES = ["proteus_idx_", "proteus_ttl_", "proteus_uniq_"];

const isManagedIndex = (name: string): boolean =>
  MANAGED_PREFIXES.some((prefix) => name.startsWith(prefix));

/**
 * Introspect existing Proteus-managed indexes from the given collections.
 *
 * - Filters only indexes with the `proteus_idx_`, `proteus_ttl_`, or `proteus_uniq_` prefix.
 * - Skips the default `_id_` index.
 * - Returns structured index metadata for comparison with desired state.
 */
export const introspectIndexes = async (
  db: Db,
  collectionNames: Array<string>,
): Promise<Array<ExistingMongoIndex>> => {
  const result: Array<ExistingMongoIndex> = [];

  for (const collName of collectionNames) {
    // Check if collection exists before listing indexes
    const collections = await db.listCollections({ name: collName }).toArray();
    if (collections.length === 0) continue;

    const collection = db.collection(collName);
    const indexes = await collection.indexes();

    for (const idx of indexes) {
      // Skip the default _id index
      if (idx.name === "_id_") continue;

      // Only include Proteus-managed indexes
      if (!idx.name || !isManagedIndex(idx.name)) continue;

      result.push({
        collection: collName,
        name: idx.name,
        keys: idx.key as Record<string, 1 | -1>,
        unique: idx.unique ?? false,
        sparse: idx.sparse ?? false,
        expireAfterSeconds:
          typeof idx.expireAfterSeconds === "number" ? idx.expireAfterSeconds : null,
      });
    }
  }

  return result;
};
