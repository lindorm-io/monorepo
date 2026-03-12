import { uniq } from "@lindorm/utils";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata, MetaRelationId } from "#internal/entity/types/metadata";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { getJoinName } from "#internal/entity/utils/get-join-name";
import { quoteIdentifier } from "../quote-identifier";
import { resolveColumnNameSafe } from "../resolve-column-name";
import { buildSimpleIn } from "./build-simple-in";

export type LoadRelationIdsContext = {
  metadata: EntityMetadata;
  namespace: string | null;
  client: MysqlQueryClient;
};

/**
 * Load async RelationId values for *ToMany and inverse *ToOne relations.
 *
 * For owning *ToOne, FK values are hydrated synchronously in defaultHydrateEntity.
 * This function handles the remaining cases that require a query.
 */
export const loadRelationIds = async <E extends IEntity>(
  entities: Array<E>,
  ctx: LoadRelationIdsContext,
): Promise<void> => {
  if (entities.length === 0 || ctx.metadata.relationIds.length === 0) return;

  for (const ri of ctx.metadata.relationIds) {
    const relation = ctx.metadata.relations.find((r) => r.key === ri.relationKey);
    if (!relation) continue;

    // Owning *ToOne is handled synchronously — skip
    if (relation.joinKeys && relation.type !== "ManyToMany") continue;

    const foreignTarget = relation.foreignConstructor();
    const foreignMeta = getEntityMetadata(foreignTarget);
    const schema = foreignMeta.entity.namespace ?? ctx.namespace;

    if (relation.type === "OneToMany") {
      await loadOneToManyIds(entities, ri, relation, foreignMeta, schema, ctx);
    } else if (
      relation.type === "ManyToMany" &&
      typeof relation.joinTable === "string" &&
      relation.joinKeys
    ) {
      await loadManyToManyIds(entities, ri, relation, foreignMeta, schema, ctx);
    } else if (relation.type === "OneToOne" && !relation.joinKeys) {
      await loadInverseOneToOneId(entities, ri, relation, foreignMeta, schema, ctx);
    }
  }
};

const loadOneToManyIds = async <E extends IEntity>(
  entities: Array<E>,
  ri: MetaRelationId,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  _schema: string | null,
  ctx: LoadRelationIdsContext,
): Promise<void> => {
  if (!relation.findKeys) return;
  const findKeys = relation.findKeys;
  const localPkKeys = Object.values(findKeys);
  const foreignFkKeys = Object.keys(findKeys);

  const targetCol = ri.column
    ? resolveColumnNameSafe(foreignMeta.fields, ri.column)
    : resolveColumnNameSafe(foreignMeta.fields, foreignMeta.primaryKeys[0]);

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

  const fkCols = foreignFkKeys.map((k) => resolveColumnNameSafe(foreignMeta.fields, k));
  const selectCols = uniq([...fkCols, targetCol])
    .map((c) => quoteIdentifier(c))
    .join(", ");

  const inCondition = buildSimpleIn(foreignMeta, foreignFkKeys, pkValues, params);
  const sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${inCondition}`;

  const { rows } = await ctx.client.query(sql, params);

  // Group by FK value
  const grouped = new Map<string, Array<unknown>>();
  for (const row of rows) {
    const fkVal = JSON.stringify(
      foreignFkKeys.map(
        (k) => (row as any)[resolveColumnNameSafe(foreignMeta.fields, k)] ?? null,
      ),
    );
    if (!grouped.has(fkVal)) grouped.set(fkVal, []);
    grouped.get(fkVal)!.push((row as any)[targetCol]);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const ids = grouped.get(pkKey) ?? [];
    for (const entity of ownerEntities) {
      (entity as any)[ri.key] = ids;
    }
  }
};

const loadManyToManyIds = async <E extends IEntity>(
  entities: Array<E>,
  ri: MetaRelationId,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  _schema: string | null,
  ctx: LoadRelationIdsContext,
): Promise<void> => {
  if (!relation.joinKeys) return;
  const joinKeys = relation.joinKeys;
  const localPkKeys = Object.values(joinKeys);
  const rootJoinCols = Object.keys(joinKeys);

  const inverseRelation = foreignMeta.relations.find(
    (r) =>
      r.type === "ManyToMany" &&
      r.foreignKey === relation.key &&
      r.key === relation.foreignKey,
  );
  if (!inverseRelation?.joinKeys) {
    for (const entity of entities) {
      (entity as any)[ri.key] = [];
    }
    return;
  }

  const foreignJoinKeys = inverseRelation.joinKeys;

  const targetJoinCol = ri.column
    ? Object.entries(foreignJoinKeys).find(([, pkKey]) => pkKey === ri.column)?.[0]
    : Object.keys(foreignJoinKeys)[0];
  if (!targetJoinCol) return;

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

  const selectCols = uniq([...rootJoinCols, targetJoinCol])
    .map((c) => quoteIdentifier(c))
    .join(", ");

  const inCondition = buildSimpleIn(null, rootJoinCols, pkValues, params);
  const sql = `SELECT ${selectCols} FROM ${joinTableName} WHERE ${inCondition}`;

  const { rows } = await ctx.client.query(sql, params);

  const grouped = new Map<string, Array<unknown>>();
  for (const row of rows) {
    const rootPkVal = JSON.stringify(rootJoinCols.map((c) => (row as any)[c] ?? null));
    if (!grouped.has(rootPkVal)) grouped.set(rootPkVal, []);
    grouped.get(rootPkVal)!.push((row as any)[targetJoinCol]);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const ids = grouped.get(pkKey) ?? [];
    for (const entity of ownerEntities) {
      (entity as any)[ri.key] = ids;
    }
  }
};

const loadInverseOneToOneId = async <E extends IEntity>(
  entities: Array<E>,
  ri: MetaRelationId,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  _schema: string | null,
  ctx: LoadRelationIdsContext,
): Promise<void> => {
  if (!relation.findKeys) return;
  const findKeys = relation.findKeys;
  const localPkKeys = Object.values(findKeys);
  const foreignFkKeys = Object.keys(findKeys);

  const targetCol = ri.column
    ? resolveColumnNameSafe(foreignMeta.fields, ri.column)
    : resolveColumnNameSafe(foreignMeta.fields, foreignMeta.primaryKeys[0]);

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

  const fkCols = foreignFkKeys.map((k) => resolveColumnNameSafe(foreignMeta.fields, k));
  const selectCols = uniq([...fkCols, targetCol])
    .map((c) => quoteIdentifier(c))
    .join(", ");

  const inCondition = buildSimpleIn(foreignMeta, foreignFkKeys, pkValues, params);
  const sql = `SELECT ${selectCols} FROM ${tableName} WHERE ${inCondition}`;

  const { rows } = await ctx.client.query(sql, params);

  const grouped = new Map<string, unknown>();
  for (const row of rows) {
    const fkVal = JSON.stringify(
      foreignFkKeys.map(
        (k) => (row as any)[resolveColumnNameSafe(foreignMeta.fields, k)] ?? null,
      ),
    );
    grouped.set(fkVal, (row as any)[targetCol]);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const id = grouped.get(pkKey) ?? null;
    for (const entity of ownerEntities) {
      (entity as any)[ri.key] = id;
    }
  }
};
