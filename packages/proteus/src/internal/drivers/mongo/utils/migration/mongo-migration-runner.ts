import type { Collection, Db, MongoClient, ClientSession } from "mongodb";
import type { MigrationRunnerBase } from "#internal/types/migration";

export type MongoMigrationContext = {
  db: () => Db;
  collection: (name: string) => Collection;
  session?: ClientSession;
};

export type MongoMigrationRunner = MigrationRunnerBase & MongoMigrationContext;

/**
 * Extract the MongoClient from a Db instance.
 * The `client` property is marked @internal in the MongoDB driver types
 * but is available at runtime. We access it via cast to avoid TS errors.
 */
const getClientFromDb = (database: Db): MongoClient =>
  (database as any).client as MongoClient;

/**
 * Create a migration runner that provides access to the MongoDB Db and collections.
 *
 * The `transaction` method wraps the callback in a MongoDB session + transaction
 * when a replica set is available. On standalone instances, it runs the callback
 * without transaction support (best-effort, no atomicity).
 */
export const createMongoMigrationRunner = (
  database: Db,
  isReplicaSet: boolean,
): MongoMigrationRunner => ({
  db: () => database,
  collection: (name: string) => database.collection(name),

  transaction: async (fn) => {
    if (!isReplicaSet) {
      // Standalone — run without transaction
      const ctx: MongoMigrationContext = {
        db: () => database,
        collection: (name: string) => database.collection(name),
      };
      await fn(ctx);
      return;
    }

    const client = getClientFromDb(database);
    const session: ClientSession = client.startSession();

    try {
      session.startTransaction();

      const ctx: MongoMigrationContext = {
        db: () => database,
        collection: (name: string) => database.collection(name),
        session,
      };

      await fn(ctx);
      await session.commitTransaction();
    } catch (err) {
      try {
        await session.abortTransaction();
      } catch {
        // Abort failure is secondary — preserve the original error
      }
      throw err;
    } finally {
      await session.endSession();
    }
  },
});
