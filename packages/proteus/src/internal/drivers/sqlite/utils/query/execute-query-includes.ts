import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { IncludeSpec } from "#internal/types/query";
import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import { defaultHydrateEntity } from "#internal/entity/utils/default-hydrate-entity";
import { resolvePolymorphicMetadata } from "#internal/entity/utils/resolve-polymorphic-metadata";
import { resolveColumnNameSafe } from "../resolve-column-name";
import {
  compileRelationQuery,
  type RelationQueryContext,
} from "./compile-relation-query";
import { extractFieldDictFromReturning } from "./extract-field-dict";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata";

export type ExecuteQueryIncludesOptions = {
  rootMetadata: EntityMetadata;
  client: SqliteQueryClient;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
  amphora?: IAmphora;
};

export const executeQueryIncludes = <E extends IEntity>(
  entities: Array<E>,
  queryIncludes: Array<IncludeSpec>,
  opts: ExecuteQueryIncludesOptions,
): void => {
  if (entities.length === 0 || queryIncludes.length === 0) return;

  const ctx: RelationQueryContext = {
    rootMetadata: opts.rootMetadata,
    namespace: opts.namespace,
    withDeleted: opts.withDeleted,
    versionTimestamp: opts.versionTimestamp,
  };

  for (const include of queryIncludes) {
    const relation = findRelationByKey(opts.rootMetadata, include.relation);
    const foreignMeta = getRelationMetadata(relation);

    const isCollection = relation.type === "OneToMany" || relation.type === "ManyToMany";

    if (
      relation.type === "ManyToMany" &&
      relation.joinTable &&
      typeof relation.joinTable === "string"
    ) {
      executeManyToManyInclude(entities, include, relation, foreignMeta, ctx, opts);
    } else if (relation.joinKeys) {
      executeOwningInclude(
        entities,
        include,
        relation,
        foreignMeta,
        isCollection,
        ctx,
        opts,
      );
    } else {
      executeInverseInclude(
        entities,
        include,
        relation,
        foreignMeta,
        isCollection,
        ctx,
        opts,
      );
    }
  }
};

const executeOwningInclude = <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  isCollection: boolean,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): void => {
  const localFkKeys = Object.keys(relation.joinKeys!);
  const foreignPkKeys = Object.values(relation.joinKeys!);

  const fkValues: Array<Array<unknown>> = [];
  const fkToEntities = new Map<string, Array<E>>();

  for (const entity of entities) {
    const vals = localFkKeys.map((k) => (entity as any)[k]);
    if (vals.some((v) => v == null)) {
      (entity as any)[include.relation] = isCollection ? [] : null;
      continue;
    }
    const key = vals.join("|");
    if (!fkToEntities.has(key)) {
      fkToEntities.set(key, []);
      fkValues.push(vals);
    }
    fkToEntities.get(key)!.push(entity);
  }

  if (fkValues.length === 0) {
    for (const entity of entities) {
      if ((entity as any)[include.relation] === undefined) {
        (entity as any)[include.relation] = isCollection ? [] : null;
      }
    }
    return;
  }

  const compiled = compileRelationQuery(include, fkValues, ctx);
  const rows = opts.client.all(compiled.text, compiled.params);

  const foreignRows = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const pkVal = foreignPkKeys
      .map((k) => {
        const colName = resolveColumnNameSafe(foreignMeta.fields, k);
        return String(row[colName] ?? "");
      })
      .join("|");
    if (!foreignRows.has(pkVal)) foreignRows.set(pkVal, []);
    foreignRows.get(pkVal)!.push(row as Dict);
  }

  for (const [fkKey, ownerEntities] of fkToEntities) {
    const rows = foreignRows.get(fkKey) ?? [];
    const hydrated = rows.map((row) =>
      hydrateRow(row, foreignMeta, include, opts.amphora),
    );

    for (const entity of ownerEntities) {
      (entity as any)[include.relation] = isCollection ? hydrated : (hydrated[0] ?? null);
    }
  }
};

const executeInverseInclude = <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  isCollection: boolean,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): void => {
  const localPkKeys = Object.values(relation.findKeys!);
  const foreignFkKeys = Object.keys(relation.findKeys!);

  const pkValues: Array<Array<unknown>> = [];
  const pkToEntities = new Map<string, Array<E>>();

  for (const entity of entities) {
    const vals = localPkKeys.map((k) => (entity as any)[k]);
    const key = vals.join("|");
    if (!pkToEntities.has(key)) {
      pkToEntities.set(key, []);
      pkValues.push(vals);
    }
    pkToEntities.get(key)!.push(entity);
  }

  const compiled = compileRelationQuery(include, pkValues, ctx);
  const rows = opts.client.all(compiled.text, compiled.params);

  const grouped = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const fkVal = foreignFkKeys
      .map((k) => {
        const colName = resolveColumnNameSafe(foreignMeta.fields, k);
        return String(row[colName] ?? "");
      })
      .join("|");
    if (!grouped.has(fkVal)) grouped.set(fkVal, []);
    grouped.get(fkVal)!.push(row as Dict);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const rows = grouped.get(pkKey) ?? [];
    const hydrated = rows.map((row) =>
      hydrateRow(row, foreignMeta, include, opts.amphora),
    );

    for (const entity of ownerEntities) {
      (entity as any)[include.relation] = isCollection ? hydrated : (hydrated[0] ?? null);
    }
  }
};

const executeManyToManyInclude = <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("#internal/entity/types/metadata").MetaRelation,
  foreignMeta: EntityMetadata,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): void => {
  const joinKeys = relation.joinKeys!;
  const localPkKeys = Object.values(joinKeys);
  const joinTableCols = Object.keys(joinKeys);

  const pkValues: Array<Array<unknown>> = [];
  const pkToEntities = new Map<string, Array<E>>();

  for (const entity of entities) {
    const vals = localPkKeys.map((k) => (entity as any)[k]);
    const key = vals.join("|");
    if (!pkToEntities.has(key)) {
      pkToEntities.set(key, []);
      pkValues.push(vals);
    }
    pkToEntities.get(key)!.push(entity);
  }

  const compiled = compileRelationQuery(include, pkValues, ctx);
  const rows = opts.client.all(compiled.text, compiled.params);

  const grouped = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const rootPkVal = joinTableCols
      .map((col) => String(row[`__jt_${col}`] ?? ""))
      .join("|");
    if (!grouped.has(rootPkVal)) grouped.set(rootPkVal, []);
    grouped.get(rootPkVal)!.push(row as Dict);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const rows = grouped.get(pkKey) ?? [];
    const hydrated = rows.map((row) =>
      hydrateRow(row, foreignMeta, include, opts.amphora),
    );

    for (const entity of ownerEntities) {
      (entity as any)[include.relation] = hydrated;
    }
  }
};

/**
 * Hydrate a single row from a query-loaded relation.
 */
const hydrateRow = (
  row: Dict,
  metadata: EntityMetadata,
  include: IncludeSpec,
  amphora?: IAmphora,
): Dict => {
  const dict = extractFieldDictFromReturning(row, metadata);
  const effectiveMeta = resolvePolymorphicMetadata(dict, metadata);

  const restrictedMeta = include.select
    ? {
        ...effectiveMeta,
        fields: effectiveMeta.fields.filter((f) => include.select!.includes(f.key)),
      }
    : effectiveMeta;

  return defaultHydrateEntity(dict, restrictedMeta, {
    snapshot: false,
    hooks: false,
    amphora,
  });
};
