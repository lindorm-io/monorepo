import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import { resolvePropertyKey } from "../../../../entity/utils/resolve-property-key.js";

/** One key pair a relation is matched on, as PROPERTY keys on each side. */
export type RelationKeyPair = {
  /** Property key on the ROOT entity. */
  localKey: string;
  /** Property key on the FOREIGN entity. */
  foreignKey: string;
};

/** The link a many-to-many's join SETs express, read the way the writer wrote it. */
export type ManyToManyLink = {
  joinTable: string;
  /** Join column the SET key is named after — the ROOT side of a link. */
  joinColumn: string;
  /** Property key on the ROOT entity whose value completes that SET key. */
  localKey: string;
  /** Property key on the FOREIGN entity that a SET member names. */
  foreignKey: string;
};

/**
 * The key pairs a non-many-to-many relation matches on.
 *
 * The owning side declares `joinKeys` — `{ localFkColumn: foreignPkColumn }` —
 * and the inverse side declares `findKeys` — `{ foreignFkColumn: localPkColumn }`.
 * Both spellings are physical COLUMNS, while a Redis hash field is always the
 * PROPERTY key, so each half is resolved against the fields of its own side.
 */
export const resolveRelationKeys = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMetadata: EntityMetadata,
): Array<RelationKeyPair> =>
  relation.joinKeys
    ? Object.entries(relation.joinKeys).map(([localColumn, foreignColumn]) => ({
        localKey: resolvePropertyKey(rootMetadata.fields, localColumn),
        foreignKey: resolvePropertyKey(foreignMetadata.fields, foreignColumn),
      }))
    : Object.entries(relation.findKeys ?? {}).map(([foreignColumn, localColumn]) => ({
        localKey: resolvePropertyKey(rootMetadata.fields, localColumn),
        foreignKey: resolvePropertyKey(foreignMetadata.fields, foreignColumn),
      }));

/**
 * The link a many-to-many is read back through.
 *
 * Redis holds a join table as SETs rather than rows: `createRedisJoinTableOps`
 * names a forward SET after the OWNER's join column and a reverse SET after the
 * TARGET's, and puts the other side's primary key in as members. Both are
 * written from `findKeys` — the relation's own and its mirror's — so both are
 * read back through the same two, which is why the mirror is looked up at all.
 *
 * Only the FIRST column pair names a SET, again matching the writer: a
 * composite many-to-many key has no representation in this layout at all.
 * `null` means the mirror could not be resolved, and a relation with no link to
 * read is an empty relation.
 */
export const resolveManyToManyLink = (
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
): ManyToManyLink | null => {
  const mirror = foreignMetadata.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey &&
      r.joinTable === relation.joinTable,
  );

  const root = Object.entries(relation.findKeys ?? {})[0];
  const foreign = Object.entries(mirror?.findKeys ?? {})[0];

  if (!root || !foreign) return null;

  return {
    joinTable: relation.joinTable as string,
    joinColumn: root[0],
    localKey: root[1],
    foreignKey: foreign[1],
  };
};

/**
 * Whether the foreign rows a relation matches can be addressed by Redis key.
 *
 * The primary key is the ONLY index Redis has: an entity lives at
 * `{ns}:entity:{name}:{pk…}` and nothing else points at it. So a relation whose
 * match keys ARE the foreign primary key is one HGETALL per root, and any other
 * relation has to SCAN the foreign keyspace to find its rows at all.
 */
export const addressableByKey = (
  foreignKeys: Array<string>,
  foreignMetadata: EntityMetadata,
): boolean =>
  foreignKeys.length === foreignMetadata.primaryKeys.length &&
  foreignMetadata.primaryKeys.every((pk) => foreignKeys.includes(pk));
