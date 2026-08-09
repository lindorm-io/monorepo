import { isString } from "@lindorm/is";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import { resolvePropertyKey } from "../../../../entity/utils/resolve-property-key.js";
import {
  resolveMongoColumnName,
  resolveMongoFieldName,
} from "../resolve-mongo-field-name.js";

/** One column pair a relation is matched on, in both spellings each side needs. */
export type RelationJoinPair = {
  /** Property key on the ROOT entity — how a hydrated root exposes the value. */
  localKey: string;
  /** Document key on the ROOT document — how a stored root holds it. */
  localDoc: string;
  /** Property key on the FOREIGN entity. */
  foreignKey: string;
  /** Document key on the FOREIGN document. */
  foreignDoc: string;
};

/** The two hops a many-to-many takes: root → join document → foreign document. */
export type ManyToManyJoin = {
  collection: string;
  root: Array<{ joinColumn: string; localKey: string; localDoc: string }>;
  foreign: Array<{ joinColumn: string; foreignKey: string; foreignDoc: string }>;
};

/** A many-to-many that goes through a join collection, as opposed to a plain FK. */
export const isJoinTableRelation = (relation: MetaRelation): boolean =>
  relation.type === "ManyToMany" && isString(relation.joinTable);

/**
 * The column pairs a non-many-to-many relation matches on.
 *
 * The owning side declares `joinKeys` — `{ localFkColumn: foreignPkKey }` — and
 * the inverse side declares `findKeys` — `{ foreignFkColumn: localPkKey }`. Both
 * name a physical COLUMN on one side and a PROPERTY key on the other, so each
 * half is resolved through the spelling that matches its own side.
 */
export const resolveRelationJoin = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMetadata: EntityMetadata,
): Array<RelationJoinPair> =>
  relation.joinKeys
    ? Object.entries(relation.joinKeys).map(([localColumn, foreignPkKey]) => ({
        localKey: resolvePropertyKey(rootMetadata.fields, localColumn),
        localDoc: resolveMongoColumnName(localColumn, rootMetadata),
        foreignKey: foreignPkKey,
        foreignDoc: resolveMongoFieldName(foreignPkKey, foreignMetadata),
      }))
    : Object.entries(relation.findKeys ?? {}).map(([foreignColumn, localPkKey]) => ({
        localKey: localPkKey,
        localDoc: resolveMongoFieldName(localPkKey, rootMetadata),
        foreignKey: resolvePropertyKey(foreignMetadata.fields, foreignColumn),
        foreignDoc: resolveMongoColumnName(foreignColumn, foreignMetadata),
      }));

/**
 * The join-collection hops a many-to-many takes.
 *
 * A join document is written by `createMongoJoinTableOps` from the `findKeys` of
 * the relation and of its mirror, one column per side — so it is read back
 * through the same two, which is why the mirror is looked up at all. The
 * collection is the join table name verbatim, again matching the writer.
 */
export const resolveManyToManyJoin = (
  relation: MetaRelation,
  rootMetadata: EntityMetadata,
  foreignMetadata: EntityMetadata,
): ManyToManyJoin | null => {
  const inverse = foreignMetadata.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey &&
      r.joinTable === relation.joinTable,
  );

  const rootKeys = relation.findKeys ?? relation.joinKeys;
  const foreignKeys = inverse?.findKeys ?? inverse?.joinKeys;

  if (!rootKeys || !foreignKeys) return null;

  return {
    collection: relation.joinTable as string,
    root: Object.entries(rootKeys).map(([joinColumn, localKey]) => ({
      joinColumn,
      localKey,
      localDoc: resolveMongoFieldName(localKey, rootMetadata),
    })),
    foreign: Object.entries(foreignKeys).map(([joinColumn, foreignKey]) => ({
      joinColumn,
      foreignKey,
      foreignDoc: resolveMongoFieldName(foreignKey, foreignMetadata),
    })),
  };
};
