import type { ClientSession, MongoClient } from "mongodb";

/**
 * Execute a callback within an implicit MongoDB transaction.
 *
 * - If running on a replica set: wraps the callback in a real session+transaction
 *   for atomicity across multiple operations (e.g., cascade saves).
 * - If running standalone: executes the callback without a session. Operations
 *   are individually atomic but not collectively atomic.
 *
 * This is used by RelationPersister cascade saves to ensure multi-collection
 * writes are atomic when possible, while degrading gracefully on standalone.
 */
export const withImplicitTransaction = async <T>(
  client: MongoClient,
  isReplicaSet: boolean,
  fn: (session: ClientSession | undefined) => Promise<T>,
): Promise<T> => {
  if (!isReplicaSet) {
    return fn(undefined);
  }

  const session = client.startSession();

  try {
    session.startTransaction({
      readConcern: { level: "majority" },
      writeConcern: { w: "majority" },
    });

    const result = await fn(session);

    await session.commitTransaction();
    return result;
  } catch (error) {
    if (session.inTransaction()) {
      await session.abortTransaction();
    }
    throw error;
  } finally {
    await session.endSession();
  }
};
