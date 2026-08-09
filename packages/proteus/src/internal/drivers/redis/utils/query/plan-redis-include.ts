import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import { resolveStorageMetadata } from "../../../../entity/utils/resolve-storage-metadata.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import { buildEntityKey } from "../build-entity-key.js";
import { buildJoinSetKey, buildReverseJoinSetKey } from "../build-join-set-key.js";
import { buildScanPattern } from "../build-scan-pattern.js";
import {
  addressableByKey,
  resolveManyToManyLink,
  resolveRelationKeys,
  type ManyToManyLink,
  type RelationKeyPair,
} from "./resolve-relation-keys.js";

/** The two SET keys holding one root row's many-to-many links. */
export type ManyToManyLinkSets = {
  row: Dict;
  forward: string;
  reverse: string;
};

/**
 * Everything one included relation needs read out of Redis, decided before a
 * single command is issued.
 *
 * A plan names KEYS, never round trips: which keys travel together is the
 * strategy's business, and the two strategies read exactly this same set.
 */
export type RedisIncludePlan = {
  include: IncludeSpec;
  relation: MetaRelation;
  foreignMetadata: EntityMetadata;
  isCollection: boolean;
  /** Key pairs the relation matches on; empty for a many-to-many. */
  pairs: Array<RelationKeyPair>;
  /** The join SETs a many-to-many is read through; `null` for anything else. */
  link: ManyToManyLink | null;
  /** One entry per root row whose local key is non-null. */
  linkSets: Array<ManyToManyLinkSets>;
  /** Foreign hashes the primary key addresses directly. */
  hashKeys: Array<string>;
  /** Foreign keyspace to SCAN, when no key addresses the rows wanted. */
  scanPattern: string | null;
  /** How a many-to-many's SET members resolve to foreign hashes. */
  memberKey: ((member: string) => string) | null;
};

export type RedisIncludePlanContext = {
  rootMetadata: EntityMetadata;
  namespace: string | null;
};

/**
 * Plan the Redis reads one included relation needs.
 *
 * Redis has no query planner and exactly one index — the key an entity is
 * stored at. So the plan is a three-way decision. A relation matched on the
 * foreign PRIMARY key is addressed directly, one HGETALL per distinct value. A
 * many-to-many goes through the join SETs, which name their members by primary
 * key, so it is addressed directly too, one hop later. Anything else — an
 * inverse relation, whose foreign key is an ordinary hash field with nothing
 * pointing at it — has no index to use and must SCAN the foreign keyspace.
 */
export const planRedisInclude = (
  rows: Array<Dict>,
  include: IncludeSpec,
  ctx: RedisIncludePlanContext,
): RedisIncludePlan => {
  const relation = findRelationByKey(ctx.rootMetadata, include.relation);
  const foreignMetadata = getRelationMetadata(relation);
  const foreignStorage = resolveStorageMetadata(foreignMetadata);
  const scanPattern = buildScanPattern(foreignStorage, ctx.namespace);

  const base = {
    include,
    relation,
    foreignMetadata,
    isCollection: relation.type === "OneToMany" || relation.type === "ManyToMany",
  };

  if (relation.type === "ManyToMany" && isString(relation.joinTable)) {
    const link = resolveManyToManyLink(relation, foreignMetadata);
    if (!link) {
      return {
        ...base,
        pairs: [],
        link: null,
        linkSets: [],
        hashKeys: [],
        scanPattern: null,
        memberKey: null,
      };
    }

    // A SET member is a single primary-key value, so it addresses a hash only
    // when the foreign entity's primary key is that one column. Anything else
    // — a composite key the SET layout cannot express — falls back to the scan.
    const addressable =
      foreignMetadata.primaryKeys.length === 1 &&
      foreignMetadata.primaryKeys[0] === link.foreignKey;

    return {
      ...base,
      pairs: [],
      link,
      linkSets: planLinkSets(rows, link, ctx.namespace),
      hashKeys: [],
      scanPattern: addressable ? null : scanPattern,
      memberKey: addressable
        ? (member) => buildEntityKey(foreignStorage, [member], ctx.namespace)
        : null,
    };
  }

  const pairs = resolveRelationKeys(relation, ctx.rootMetadata, foreignMetadata);
  const addressable =
    pairs.length > 0 &&
    addressableByKey(
      pairs.map((pair) => pair.foreignKey),
      foreignMetadata,
    );

  return {
    ...base,
    pairs,
    link: null,
    linkSets: [],
    hashKeys: addressable
      ? planDirectKeys(rows, pairs, foreignMetadata, foreignStorage, ctx.namespace)
      : [],
    scanPattern: addressable ? null : scanPattern,
    memberKey: null,
  };
};

/**
 * The distinct entity keys the root rows point at. A root whose key value is
 * null points at nothing — SQL's `IN (…)` never matches on NULL either — and
 * `encodePkSegment` would reject it besides.
 */
const planDirectKeys = (
  rows: Array<Dict>,
  pairs: Array<RelationKeyPair>,
  foreignMetadata: EntityMetadata,
  foreignStorage: EntityMetadata,
  namespace: string | null,
): Array<string> => {
  const localByForeign = new Map(pairs.map((pair) => [pair.foreignKey, pair.localKey]));
  const keys = new Set<string>();

  for (const row of rows) {
    const values: Array<unknown> = [];
    for (const primaryKey of foreignMetadata.primaryKeys) {
      const value = row[localByForeign.get(primaryKey)!];
      if (value == null) break;
      values.push(value);
    }
    if (values.length !== foreignMetadata.primaryKeys.length) continue;
    keys.add(buildEntityKey(foreignStorage, values, namespace));
  }

  return [...keys];
};

/**
 * Both SET keys every root row's links may live under. Which one holds them
 * depends on which side of the relation last synced, so both are read and
 * unioned — the same pair `RedisRepository` reads for a lazy many-to-many.
 */
const planLinkSets = (
  rows: Array<Dict>,
  link: ManyToManyLink,
  namespace: string | null,
): Array<ManyToManyLinkSets> => {
  const sets: Array<ManyToManyLinkSets> = [];

  for (const row of rows) {
    const value = row[link.localKey];
    if (value == null) continue;

    sets.push({
      row,
      forward: buildJoinSetKey(link.joinTable, link.joinColumn, value, namespace),
      reverse: buildReverseJoinSetKey(link.joinTable, link.joinColumn, value, namespace),
    });
  }

  return sets;
};
