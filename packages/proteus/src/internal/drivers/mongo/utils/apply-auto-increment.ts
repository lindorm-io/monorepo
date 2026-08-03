import type { ClientSession, Db, Document } from "mongodb";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { shouldAutoIncrement } from "../../../entity/utils/should-auto-increment.js";

/**
 * Mint the `@Generated("increment"|"identity")` values of one document from the
 * `_proteus_sequences` collection, using `findOneAndUpdate` + `$inc` so the
 * counter is atomic.
 *
 * Shared by MongoExecutor and MongoInsertQueryBuilder. The builder had no
 * auto-increment step at all, so a `@Generated("increment")` PK went to Mongo
 * unset, Mongo minted an ObjectId in its place, and the read back blew up
 * converting that object to the column's declared bigint.
 */
export const applyAutoIncrement = async (
  doc: Document,
  metadata: EntityMetadata,
  db: Db,
  session?: ClientSession,
): Promise<void> => {
  for (const gen of metadata.generated) {
    const field = metadata.fields.find((f) => f.key === gen.key);
    const isPk = metadata.primaryKeys.includes(gen.key);
    const currentValue = isPk ? doc._id : doc[field?.name ?? gen.key];

    if (!shouldAutoIncrement(gen, currentValue)) continue;

    const result = await db.collection("_proteus_sequences").findOneAndUpdate(
      { _id: `${metadata.entity.name}.${gen.key}` as any },
      { $inc: { seq: 1 } },
      {
        upsert: true,
        returnDocument: "after",
        ...(session ? { session } : {}),
      },
    );

    const seq = (result as any)?.seq ?? 1;

    // Mint the value in the column's DECLARED type: a `bigint` column must get
    // a JS bigint. The sequence counter is a BSON int, so a bigint column
    // would otherwise be minted as a number and mismatch reads (which hydrate
    // to bigint), making `findOne({ id: 2n })` and bigint FK lookups miss.
    const nextVal = field?.type === "bigint" ? BigInt(seq) : seq;

    if (isPk) {
      doc._id = nextVal;
    } else {
      doc[field?.name ?? gen.key] = nextVal;
    }
  }
};
