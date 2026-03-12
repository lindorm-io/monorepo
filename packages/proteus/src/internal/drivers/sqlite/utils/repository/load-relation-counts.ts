import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata, MetaRelationCount } from "#internal/entity/types/metadata";
import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { getJoinName } from "#internal/entity/utils/get-join-name";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { buildSimpleIn } from "./build-simple-in";

export type LoadRelationCountsContext = {
  metadata: EntityMetadata;
  namespace: string | null;
  client: SqliteQueryClient;
};

/**
 * Batched COUNT queries for @RelationCount fields.
 *
 * For OneToMany:
 *   SELECT fk_col, COUNT(*) FROM child_table WHERE fk_col IN (...) GROUP BY fk_col
 *
 * For ManyToMany:
 *   SELECT root_join_col, COUNT(*) FROM join_table WHERE root_join_col IN (...) GROUP BY root_join_col
 */
export const loadRelationCounts = <E extends IEntity>(
  entities: Array<E>,
  ctx: LoadRelationCountsContext,
): void => {
  if (entities.length === 0 || ctx.metadata.relationCounts.length === 0) return;

  for (const rc of ctx.metadata.relationCounts) {
    const relation = ctx.metadata.relations.find((r) => r.key === rc.relationKey);
    if (!relation) continue;

    const foreignTarget = relation.foreignConstructor();
    const foreignMeta = getEntityMetadata(foreignTarget);

    if (relation.type === "OneToMany") {
      loadOneToManyCount(entities, rc, relation, foreignMeta, ctx);
    } else if (
      relation.type === "ManyToMany" &&
      typeof relation.joinTable === "string" &&
      relation.joinKeys
    ) {
      loadManyToManyCount(entities, rc, relation, ctx);
    }
  }
};

const loadOneToManyCount = <E extends IEntity>(
  entities: Array<E>,
  rc: MetaRelationCount,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  ctx: LoadRelationCountsContext,
): void => {
  if (!relation.findKeys) return;
  const findKeys = relation.findKeys;
  const localPkKeys = Object.values(findKeys);
  const foreignFkKeys = Object.keys(findKeys);

  const pkToEntities = new Map<string, Array<E>>();
  const pkValues: Array<Array<unknown>> = [];

  for (const entity of entities) {
    const vals = localPkKeys.map((k) => (entity as any)[k]);
    const key = JSON.stringify(vals);
    if (!pkToEntities.has(key)) {
      pkToEntities.set(key, []);
      pkValues.push(vals);
    }
    pkToEntities.get(key)!.push(entity);
  }

  if (pkValues.length === 0) return;

  const tableName = quoteIdentifier(foreignMeta.entity.name);
  const params: Array<unknown> = [];

  const fkCols = foreignFkKeys.map((k) => {
    const colName = resolveColumnNameSafe(foreignMeta.fields, k);
    return quoteIdentifier(colName);
  });

  const inCondition = buildSimpleIn(foreignMeta, foreignFkKeys, pkValues, params);
  const groupByClause = fkCols.join(", ");
  const sql = `SELECT ${fkCols.join(", ")}, COUNT(*) AS "count" FROM ${tableName} WHERE ${inCondition} GROUP BY ${groupByClause}`;

  const rows = ctx.client.all(sql, params);

  const countMap = new Map<string, number>();
  for (const row of rows) {
    const fkVal = JSON.stringify(
      foreignFkKeys.map(
        (k) => (row as any)[resolveColumnNameSafe(foreignMeta.fields, k)] ?? null,
      ),
    );
    countMap.set(fkVal, parseInt(String((row as any).count), 10));
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const count = countMap.get(pkKey) ?? 0;
    for (const entity of ownerEntities) {
      (entity as any)[rc.key] = count;
    }
  }
};

const loadManyToManyCount = <E extends IEntity>(
  entities: Array<E>,
  rc: MetaRelationCount,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  ctx: LoadRelationCountsContext,
): void => {
  if (!relation.joinKeys) return;
  const joinKeys = relation.joinKeys;
  const localPkKeys = Object.values(joinKeys);
  const rootJoinCols = Object.keys(joinKeys);

  const pkToEntities = new Map<string, Array<E>>();
  const pkValues: Array<Array<unknown>> = [];

  for (const entity of entities) {
    const vals = localPkKeys.map((k) => (entity as any)[k]);
    const key = JSON.stringify(vals);
    if (!pkToEntities.has(key)) {
      pkToEntities.set(key, []);
      pkValues.push(vals);
    }
    pkToEntities.get(key)!.push(entity);
  }

  if (pkValues.length === 0) return;

  const joinName = getJoinName(relation.joinTable as string, {
    namespace: ctx.namespace,
  });
  const joinTableName = quoteIdentifier(joinName.name);
  const params: Array<unknown> = [];

  const joinCols = rootJoinCols.map((c) => quoteIdentifier(c));
  const inCondition = buildSimpleIn(null, rootJoinCols, pkValues, params);
  const groupByClause = joinCols.join(", ");
  const sql = `SELECT ${joinCols.join(", ")}, COUNT(*) AS "count" FROM ${joinTableName} WHERE ${inCondition} GROUP BY ${groupByClause}`;

  const rows = ctx.client.all(sql, params);

  const countMap = new Map<string, number>();
  for (const row of rows) {
    const rootPkVal = JSON.stringify(rootJoinCols.map((c) => (row as any)[c] ?? null));
    countMap.set(rootPkVal, parseInt(String((row as any).count), 10));
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const count = countMap.get(pkKey) ?? 0;
    for (const entity of ownerEntities) {
      (entity as any)[rc.key] = count;
    }
  }
};
