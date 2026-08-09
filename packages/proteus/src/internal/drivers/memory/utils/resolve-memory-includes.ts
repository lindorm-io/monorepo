import { isString } from "@lindorm/is";
import type { Dict } from "@lindorm/types";
import type { EntityMetadata, MetaRelation } from "../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../types/query.js";
import type { RowIncludeMatch } from "../../../utils/query/attach-row-includes.js";
import type { MemoryStore, MemoryTable } from "../types/memory-store.js";
import { getJoinName } from "../../../entity/utils/get-join-name.js";
import { resolvePropertyKey } from "../../../entity/utils/resolve-property-key.js";
import { applyOrdering } from "../../../utils/query/apply-ordering.js";
import { filterRelationRows } from "../../../utils/query/filter-relation-rows.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../utils/query/get-relation-metadata.js";
import { compositeKey, indexAndMatch } from "../../../utils/query/match-relation-rows.js";
import { resolveTableKey } from "./memory-referential-integrity.js";

export type MemoryIncludeContext = {
  rootMetadata: EntityMetadata;
  store: MemoryStore;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
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
): Array<RowIncludeMatch> =>
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
 * window, and the per-relation `where`.
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

  return filterRelationRows([...table.values()], foreignMetadata, include, {
    withDeleted: ctx.withDeleted,
    versionTimestamp: ctx.versionTimestamp,
  });
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
