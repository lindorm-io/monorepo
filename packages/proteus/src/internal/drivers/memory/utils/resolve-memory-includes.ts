import { isString } from "@lindorm/is";
import { Matcher } from "@lindorm/match";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaRelation } from "../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../types/query.js";
import type { MemoryStore, MemoryTable } from "../types/memory-store.js";
import { generateAutoFilters } from "../../../entity/metadata/auto-filters.js";
import { getJoinName } from "../../../entity/utils/get-join-name.js";
import { resolvePropertyKey } from "../../../entity/utils/resolve-property-key.js";
import { applyOrdering } from "../../../utils/query/apply-ordering.js";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../utils/query/get-relation-metadata.js";
import { mergeSystemFilterOverrides } from "../../../utils/query/merge-system-filter-overrides.js";
import { resolveFilters } from "../../../utils/query/resolve-filters.js";
import { resolveTableKey } from "./memory-referential-integrity.js";

export type MemoryIncludeContext = {
  rootMetadata: EntityMetadata;
  store: MemoryStore;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
};

export type MemoryIncludeMatch = {
  include: IncludeSpec;
  relation: MetaRelation;
  foreignMetadata: EntityMetadata;
  isCollection: boolean;
  /** Matched foreign rows per root row, keyed by row identity. */
  rows: Map<Dict, Array<Dict>>;
};

/**
 * Resolve the foreign rows every root row's included relations match.
 *
 * `IncludeSpec.strategy` is READ NOWHERE in this module, and that is deliberate.
 * The strategy names a round-trip shape — "join" asks for the fewest trips to
 * the store, "query" for more but smaller ones — and the memory driver makes no
 * round trips at all, because the store is the same process and the same heap.
 * Both strategies therefore describe the identical piece of work here, and
 * ignoring the option IS the faithful behaviour, not a gap. Do not split this
 * into two code paths "for parity": two paths over one store can only drift
 * apart, and the TCK pins the two strategies to identical results.
 */
export const resolveMemoryIncludes = (
  rows: Array<Dict>,
  includes: Array<IncludeSpec>,
  ctx: MemoryIncludeContext,
): Array<MemoryIncludeMatch> =>
  includes.map((include) => {
    const relation = findRelationByKey(ctx.rootMetadata, include.relation);
    const foreignMetadata = getRelationMetadata(relation);
    const candidates = selectForeignRows(foreignMetadata, include, ctx);

    return {
      include,
      relation,
      foreignMetadata,
      isCollection: relation.type === "OneToMany" || relation.type === "ManyToMany",
      rows: matchRows(rows, candidates, relation, foreignMetadata, ctx),
    };
  });

/**
 * The candidate set a relation is drawn from: every row of the foreign table
 * that survives the foreign entity's own system filters, the temporal-version
 * window, and the per-relation `where`. The SQL drivers apply exactly these
 * three to the joined/queried table, so a relation filtered to nothing here
 * lands in the same place as a relation with no match at all.
 */
const selectForeignRows = (
  foreignMetadata: EntityMetadata,
  include: IncludeSpec,
  ctx: MemoryIncludeContext,
): Array<Dict> => {
  const table: MemoryTable | undefined = ctx.store.tables.get(
    resolveTableKey(foreignMetadata, ctx.namespace),
  );
  if (!table) return [];

  let rows: Array<Dict> = [...table.values()];

  // An inheritance child shares the root table in memory, so the discriminator
  // is what separates it from its siblings.
  const inheritance = foreignMetadata.inheritance;
  if (inheritance && inheritance.discriminatorValue != null) {
    rows = rows.filter(
      (row) => row[inheritance.discriminatorField] === inheritance.discriminatorValue,
    );
  }

  const startField = foreignMetadata.fields.find(
    (f) => f.decorator === "VersionStartDate",
  );
  const endField = foreignMetadata.fields.find((f) => f.decorator === "VersionEndDate");
  if (startField && endField) {
    rows = ctx.versionTimestamp
      ? rows.filter((row) => inVersionWindow(row, startField.key, endField.key, ctx))
      : rows.filter((row) => row[endField.key] == null);
  }

  const metaFilters = foreignMetadata.filters?.length
    ? foreignMetadata.filters
    : generateAutoFilters(foreignMetadata.fields);
  const overrides = mergeSystemFilterOverrides(undefined, ctx.withDeleted);
  for (const filter of resolveFilters(metaFilters, new Map(), overrides)) {
    rows = Matcher.filter(rows, filter.predicate);
  }

  if (include.where) {
    rows = Matcher.filter(
      rows,
      flattenEmbeddedCriteria(include.where, foreignMetadata) as never,
    );
  }

  return rows;
};

const inVersionWindow = (
  row: Dict,
  startKey: string,
  endKey: string,
  ctx: MemoryIncludeContext,
): boolean => {
  const ts = ctx.versionTimestamp!.getTime();
  const start = row[startKey];
  const end = row[endKey];
  const startTime = start == null ? 0 : new Date(start as string).getTime();
  const endTime = end == null ? Infinity : new Date(end as string).getTime();
  return startTime <= ts && ts < endTime;
};

const matchRows = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  ctx: MemoryIncludeContext,
): Map<Dict, Array<Dict>> => {
  const matched =
    relation.type === "ManyToMany" && isString(relation.joinTable)
      ? matchManyToMany(rows, candidates, relation, foreignMetadata, ctx)
      : relation.joinKeys
        ? matchOwning(rows, candidates, relation, foreignMetadata, ctx)
        : matchInverse(rows, candidates, relation, foreignMetadata, ctx);

  if (relation.orderBy) {
    for (const [row, related] of matched) {
      matched.set(row, applyOrdering(related, relation.orderBy));
    }
  }

  return matched;
};

/** Owning side (ManyToOne / owning OneToOne): the root row carries the FK. */
const matchOwning = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  ctx: MemoryIncludeContext,
): Map<Dict, Array<Dict>> => {
  const localKeys = Object.keys(relation.joinKeys!).map((column) =>
    resolvePropertyKey(ctx.rootMetadata.fields, column),
  );
  const foreignKeys = Object.values(relation.joinKeys!).map((column) =>
    resolvePropertyKey(foreignMetadata.fields, column),
  );

  return indexAndMatch(rows, candidates, localKeys, foreignKeys);
};

/** Inverse side (OneToMany / inverse OneToOne): the foreign row carries the FK. */
const matchInverse = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  ctx: MemoryIncludeContext,
): Map<Dict, Array<Dict>> => {
  const foreignKeys = Object.keys(relation.findKeys!).map((column) =>
    resolvePropertyKey(foreignMetadata.fields, column),
  );
  const localKeys = Object.values(relation.findKeys!).map((column) =>
    resolvePropertyKey(ctx.rootMetadata.fields, column),
  );

  return indexAndMatch(rows, candidates, localKeys, foreignKeys);
};

/**
 * ManyToMany: the link lives in the join table, so root rows are matched to
 * join rows first and the join rows then name the foreign PKs.
 */
const matchManyToMany = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  relation: MetaRelation,
  foreignMetadata: EntityMetadata,
  ctx: MemoryIncludeContext,
): Map<Dict, Array<Dict>> => {
  const result = new Map<Dict, Array<Dict>>(rows.map((row) => [row, []]));

  const inverseRelation = foreignMetadata.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey,
  );

  // The owning side declares `joinKeys`; on the inverse side they arrive as
  // `findKeys`. Either way the FOREIGN join columns are the ones the other side
  // declares, which is why the inverse relation is looked up at all.
  const rootJoinKeys = relation.joinKeys ?? relation.findKeys;
  const foreignJoinKeys = inverseRelation?.joinKeys ?? relation.findKeys;

  if (!rootJoinKeys || !foreignJoinKeys) return result;

  const joinName = getJoinName(relation.joinTable as string, {
    namespace: ctx.namespace,
  });
  const joinTable = ctx.store.joinTables.get(
    joinName.namespace ? `${joinName.namespace}.${joinName.name}` : joinName.name,
  );
  if (!joinTable) return result;

  const rootJoinColumns = Object.keys(rootJoinKeys);
  const rootLocalKeys = Object.values(rootJoinKeys).map((column) =>
    resolvePropertyKey(ctx.rootMetadata.fields, column),
  );
  const foreignJoinColumns = Object.keys(foreignJoinKeys);
  const foreignLocalKeys = Object.values(foreignJoinKeys).map((column) =>
    resolvePropertyKey(foreignMetadata.fields, column),
  );

  const candidatesByPk = new Map<string, Array<Dict>>();
  for (const candidate of candidates) {
    const key = compositeKey(candidate, foreignLocalKeys);
    if (key === null) continue;
    const bucket = candidatesByPk.get(key);
    if (bucket) bucket.push(candidate);
    else candidatesByPk.set(key, [candidate]);
  }

  const joinRowsByRoot = new Map<string, Array<Dict>>();
  for (const joinRow of joinTable.values()) {
    const key = compositeKey(joinRow, rootJoinColumns);
    if (key === null) continue;
    const bucket = joinRowsByRoot.get(key);
    if (bucket) bucket.push(joinRow);
    else joinRowsByRoot.set(key, [joinRow]);
  }

  for (const row of rows) {
    const key = compositeKey(row, rootLocalKeys);
    if (key === null) continue;

    const related: Array<Dict> = [];
    for (const joinRow of joinRowsByRoot.get(key) ?? []) {
      const foreignKey = compositeKey(joinRow, foreignJoinColumns);
      if (foreignKey === null) continue;
      related.push(...(candidatesByPk.get(foreignKey) ?? []));
    }
    result.set(row, related);
  }

  return result;
};

const indexAndMatch = (
  rows: Array<Dict>,
  candidates: Array<Dict>,
  localKeys: Array<string>,
  foreignKeys: Array<string>,
): Map<Dict, Array<Dict>> => {
  const byKey = new Map<string, Array<Dict>>();
  for (const candidate of candidates) {
    const key = compositeKey(candidate, foreignKeys);
    if (key === null) continue;
    const bucket = byKey.get(key);
    if (bucket) bucket.push(candidate);
    else byKey.set(key, [candidate]);
  }

  const result = new Map<Dict, Array<Dict>>();
  for (const row of rows) {
    const key = compositeKey(row, localKeys);
    result.set(row, key === null ? [] : (byKey.get(key) ?? []));
  }
  return result;
};

/**
 * Join a row's key columns into one comparable string, or `null` when any part
 * is nullish — SQL's `IN (…)` never matches on NULL, so neither does this.
 */
const compositeKey = (row: Dict, keys: Array<string>): string | null => {
  const values: Array<unknown> = [];
  for (const key of keys) {
    const value = row[key];
    if (value == null) return null;
    values.push(value instanceof Date ? value.toISOString() : value);
  }
  return JSON.stringify(values);
};
