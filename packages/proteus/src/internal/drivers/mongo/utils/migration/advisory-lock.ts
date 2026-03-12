import type { Db } from "mongodb";
import { hostname } from "os";

const LOCK_COLLECTION = "_proteus_locks";
const LOCK_TTL_SECONDS = 300; // 5 minutes safety net

const buildLockId = (namespace: string | null): string => {
  const ns = namespace ?? "default";
  return `migration_${ns}`;
};

/**
 * Ensure the locks collection exists with a TTL index on lockedAt
 * as a safety net for abandoned locks.
 */
export const ensureLockCollection = async (db: Db): Promise<void> => {
  const collections = await db.listCollections({ name: LOCK_COLLECTION }).toArray();
  if (collections.length === 0) {
    await db.createCollection(LOCK_COLLECTION);
  }

  // Create TTL index (idempotent — will no-op if already exists with same config)
  try {
    await db.collection(LOCK_COLLECTION).createIndex(
      { lockedAt: 1 },
      {
        name: "proteus_ttl_lock_expiry",
        expireAfterSeconds: LOCK_TTL_SECONDS,
      },
    );
  } catch {
    // Index may already exist — ignore
  }
};

/**
 * Acquire an advisory lock for migration operations.
 * Uses insertOne with _id uniqueness as the locking mechanism.
 * Returns true if the lock was acquired, false if already held.
 */
export const acquireLock = async (
  db: Db,
  namespace?: string | null,
): Promise<boolean> => {
  await ensureLockCollection(db);

  const lockId = buildLockId(namespace ?? null);

  try {
    await db.collection(LOCK_COLLECTION).insertOne({
      _id: lockId as any,
      lockedAt: new Date(),
      lockedBy: `${hostname()}:${process.pid}`,
    });
    return true;
  } catch (error: any) {
    // Duplicate key error (code 11000) means the lock is already held
    if (error?.code === 11000) {
      return false;
    }
    throw error;
  }
};

/**
 * Release the advisory lock for migration operations.
 */
export const releaseLock = async (db: Db, namespace?: string | null): Promise<void> => {
  const lockId = buildLockId(namespace ?? null);
  try {
    await db.collection(LOCK_COLLECTION).deleteOne({ _id: lockId as any });
  } catch {
    // Best effort — TTL will clean up eventually
  }
};
