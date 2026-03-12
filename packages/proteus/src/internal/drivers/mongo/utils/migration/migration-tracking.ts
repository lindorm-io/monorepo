import type { ClientSession, Db } from "mongodb";
import type { MigrationRecord } from "#internal/types/migration";
import { MongoMigrationError } from "../../errors/MongoMigrationError";

const COLLECTION_NAME = "_proteus_migrations";

const getCollection = (db: Db, tableName?: string) =>
  db.collection(tableName ?? COLLECTION_NAME);

type MigrationDoc = {
  _id: string;
  name: string;
  checksum: string;
  createdAt: Date;
  startedAt: Date;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

const toRecord = (doc: MigrationDoc): MigrationRecord => ({
  id: doc._id,
  name: doc.name,
  checksum: doc.checksum,
  createdAt: doc.createdAt,
  startedAt: doc.startedAt,
  finishedAt: doc.finishedAt,
  rolledBackAt: doc.rolledBackAt,
});

export const ensureMigrationCollection = async (
  db: Db,
  tableName?: string,
): Promise<void> => {
  const collName = tableName ?? COLLECTION_NAME;
  const collections = await db.listCollections({ name: collName }).toArray();
  if (collections.length === 0) {
    await db.createCollection(collName);
  }
};

export const getAppliedMigrations = async (
  db: Db,
  tableName?: string,
): Promise<Array<MigrationRecord>> => {
  const coll = getCollection(db, tableName);
  const docs = await coll
    .find({
      finishedAt: { $ne: null },
      rolledBackAt: null,
    })
    .sort({ createdAt: 1, name: 1 })
    .toArray();
  return docs.map((d) => toRecord(d as unknown as MigrationDoc));
};

export const getAllMigrationRecords = async (
  db: Db,
  tableName?: string,
): Promise<Array<MigrationRecord>> => {
  const coll = getCollection(db, tableName);
  const docs = await coll.find({}).sort({ createdAt: 1, name: 1 }).toArray();
  return docs.map((d) => toRecord(d as unknown as MigrationDoc));
};

export const getPartiallyAppliedMigrations = async (
  db: Db,
  tableName?: string,
): Promise<Array<MigrationRecord>> => {
  const coll = getCollection(db, tableName);
  const docs = await coll
    .find({
      startedAt: { $ne: null },
      finishedAt: null,
      rolledBackAt: null,
    })
    .sort({ createdAt: 1, name: 1 })
    .toArray();
  return docs.map((d) => toRecord(d as unknown as MigrationDoc));
};

export const insertMigrationRecord = async (
  db: Db,
  record: {
    id: string;
    name: string;
    checksum: string;
    createdAt: Date;
    startedAt: Date;
  },
  tableName?: string,
  session?: ClientSession,
): Promise<void> => {
  const coll = getCollection(db, tableName);

  // Upsert by name to handle re-runs after crash cleanup.
  // _id is immutable in MongoDB — use $setOnInsert so it's only set on new documents.
  await coll.updateOne(
    { name: record.name },
    {
      $setOnInsert: {
        _id: record.id,
      },
      $set: {
        name: record.name,
        checksum: record.checksum,
        createdAt: record.createdAt,
        startedAt: record.startedAt,
        finishedAt: null,
        rolledBackAt: null,
      },
    },
    { upsert: true, session },
  );
};

export const markMigrationFinished = async (
  db: Db,
  id: string,
  tableName?: string,
  session?: ClientSession,
): Promise<void> => {
  const coll = getCollection(db, tableName);
  const result = await coll.updateOne(
    { _id: id as any },
    { $set: { finishedAt: new Date() } },
    { session },
  );
  if (result.matchedCount === 0) {
    throw new MongoMigrationError("No migration record found", {
      debug: { id },
    });
  }
};

export const markMigrationRolledBack = async (
  db: Db,
  id: string,
  tableName?: string,
  session?: ClientSession,
): Promise<void> => {
  const coll = getCollection(db, tableName);
  const now = new Date();

  // Use aggregation pipeline update to conditionally set finishedAt
  const result = await coll.updateOne(
    { _id: id as any },
    [
      {
        $set: {
          rolledBackAt: now,
          finishedAt: { $ifNull: ["$finishedAt", now] },
        },
      },
    ],
    { session },
  );

  if (result.matchedCount === 0) {
    throw new MongoMigrationError("No migration record found", {
      debug: { id },
    });
  }
};

export const markMigrationFailed = async (
  db: Db,
  id: string,
  tableName?: string,
): Promise<void> => {
  // Keep the record in started state for crash detection
  // No-op beyond what insert already did — record stays with finishedAt: null
  const coll = getCollection(db, tableName);
  await coll.updateOne(
    { _id: id as any },
    { $set: { finishedAt: null, rolledBackAt: null } },
  );
};
