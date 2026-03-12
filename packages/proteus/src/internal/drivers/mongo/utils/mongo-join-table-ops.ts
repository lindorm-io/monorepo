import type { ClientSession, Db } from "mongodb";
import type { IEntity } from "../../../../interfaces";
import type { MetaRelation } from "#internal/entity/types/metadata";
import type { JoinTableOps } from "#internal/types/join-table-ops";

/**
 * Create MongoDB collection-based join table operations for M2M relations.
 *
 * Each M2M relation uses a separate join collection. Documents contain
 * two FK fields (one per side) with a compound unique index on both.
 */
export const createMongoJoinTableOps = (
  db: Db,
  session?: ClientSession,
): JoinTableOps => ({
  sync: async (
    entity: IEntity,
    relatedEntities: Array<IEntity>,
    relation: MetaRelation,
    mirror: MetaRelation,
    _namespace: string | null,
  ): Promise<void> => {
    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    const targetFindKeys = Object.entries(mirror.findKeys ?? {});

    if (ownerFindKeys.length === 0 || targetFindKeys.length === 0) return;

    const joinTableName = relation.joinTable as string;
    const joinCollection = db.collection(joinTableName);

    const [ownerJoinCol, ownerEntityKey] = ownerFindKeys[0];
    const [targetJoinCol, targetEntityKey] = targetFindKeys[0];

    const ownerPkValue = (entity as any)[ownerEntityKey];
    const sessionOpts = session ? { session } : undefined;

    // Get existing join rows for this owner
    const existingDocs = await joinCollection
      .find({ [ownerJoinCol]: ownerPkValue }, sessionOpts)
      .toArray();

    const existingTargetPks = new Set(existingDocs.map((d) => String(d[targetJoinCol])));

    // Build desired target PK set
    const desiredTargetPks = new Set<string>();
    for (const related of relatedEntities) {
      desiredTargetPks.add(String((related as any)[targetEntityKey]));
    }

    // Compute diff
    const toAdd: Array<unknown> = [];
    const toRemove: Array<unknown> = [];

    for (const related of relatedEntities) {
      const targetPk = (related as any)[targetEntityKey];
      if (!existingTargetPks.has(String(targetPk))) {
        toAdd.push(targetPk);
      }
    }

    for (const doc of existingDocs) {
      const targetPk = doc[targetJoinCol];
      if (!desiredTargetPks.has(String(targetPk))) {
        toRemove.push(targetPk);
      }
    }

    if (toAdd.length === 0 && toRemove.length === 0) return;

    // Insert new join rows
    if (toAdd.length > 0) {
      const docs = toAdd.map((targetPk) => ({
        [ownerJoinCol]: ownerPkValue,
        [targetJoinCol]: targetPk,
      }));

      await joinCollection
        .insertMany(docs, {
          ordered: false,
          ...sessionOpts,
        })
        .catch((err) => {
          // Ignore duplicate key errors on join rows (idempotent)
          if (err?.code !== 11000) throw err;
        });
    }

    // Remove old join rows
    if (toRemove.length > 0) {
      await joinCollection.deleteMany(
        {
          [ownerJoinCol]: ownerPkValue,
          [targetJoinCol]: { $in: toRemove },
        },
        sessionOpts,
      );
    }
  },

  delete: async (
    entity: IEntity,
    relation: MetaRelation,
    _namespace: string | null,
  ): Promise<void> => {
    const ownerFindKeys = Object.entries(relation.findKeys ?? {});
    if (ownerFindKeys.length === 0) return;

    const joinTableName = relation.joinTable as string;
    const joinCollection = db.collection(joinTableName);

    const [ownerJoinCol, ownerEntityKey] = ownerFindKeys[0];
    const ownerPkValue = (entity as any)[ownerEntityKey];

    const sessionOpts = session ? { session } : undefined;

    // Delete all join rows for this owner
    await joinCollection.deleteMany({ [ownerJoinCol]: ownerPkValue }, sessionOpts);
  },
});
