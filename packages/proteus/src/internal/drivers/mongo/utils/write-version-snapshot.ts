import type { ClientSession, Db, Document } from "mongodb";

/**
 * Write a version snapshot of a dehydrated document to the shadow collection.
 * Used for temporal versioning (A15).
 *
 * The shadow collection stores a copy of every insert/update with
 * __version (incrementing) and __versionedAt (timestamp) fields.
 */
export const writeVersionSnapshot = async (
  db: Db,
  collectionName: string,
  dehydratedDoc: Document,
  version: number,
  session?: ClientSession,
  versionedAt?: Date,
): Promise<void> => {
  const shadowCollection = db.collection(`${collectionName}_versions`);

  // Copy the document, replacing _id with __entityId so MongoDB can
  // generate its own _id for the version snapshot document
  const { _id, ...rest } = dehydratedDoc;
  const doc: Document = {
    __entityId: _id,
    ...rest,
    __version: version,
    __versionedAt: versionedAt ?? new Date(),
  };

  const opts = session ? { session } : undefined;
  await shadowCollection.insertOne(doc, opts);
};
