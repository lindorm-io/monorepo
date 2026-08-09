import { isString } from "@lindorm/is";
import type { IAmphora } from "@lindorm/amphora";
import type { Dict } from "@lindorm/types";
import type { IEntity } from "../../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import { defaultHydrateEntity } from "../../../../entity/utils/default-hydrate-entity.js";
import { resolvePolymorphicMetadata } from "../../../../entity/utils/resolve-polymorphic-metadata.js";
import { resolvePropertyKey } from "../../../../entity/utils/resolve-property-key.js";
import type { IncludeProjection } from "../../../../utils/query/include-projection.js";
import {
  clearImplicitKeys,
  includeProjection,
  queryStitchKeys,
  restrictToProjection,
} from "../../../../utils/query/include-projection.js";
import { resolveColumnNameSafe } from "../resolve-column-name.js";
import {
  compileRelationQuery,
  type RelationQueryContext,
} from "./compile-relation-query.js";
import { extractFieldDictFromReturning } from "./extract-field-dict.js";
import { findRelationByKey, getRelationMetadata } from "./get-relation-metadata.js";

export type ExecuteQueryIncludesOptions = {
  rootMetadata: EntityMetadata;
  client: MysqlQueryClient;
  namespace: string | null;
  withDeleted: boolean;
  versionTimestamp: Date | null;
  amphora?: IAmphora;
};

export const executeQueryIncludes = async <E extends IEntity>(
  entities: Array<E>,
  queryIncludes: Array<IncludeSpec>,
  opts: ExecuteQueryIncludesOptions,
): Promise<void> => {
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
      isString(relation.joinTable)
    ) {
      await executeManyToManyInclude(entities, include, relation, foreignMeta, ctx, opts);
    } else if (relation.joinKeys) {
      await executeOwningInclude(
        entities,
        include,
        relation,
        foreignMeta,
        isCollection,
        ctx,
        opts,
      );
    } else {
      await executeInverseInclude(
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

const executeOwningInclude = async <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("../../../../entity/types/metadata.js").MetaRelation,
  foreignMeta: EntityMetadata,
  isCollection: boolean,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): Promise<void> => {
  // `joinKeys` names PHYSICAL columns, but the values are read off a HYDRATED
  // entity, which is keyed by PROPERTY. The two diverge under a renaming
  // strategy (`author_id` / `authorId`) — reading the column name there yields
  // `undefined` for every root, which this function then reports as "no FK", so
  // the relation came back empty without a query ever being issued.
  const projection = includeProjection(include, relation, foreignMeta, queryStitchKeys);

  const localFkKeys = Object.keys(relation.joinKeys!).map((column) =>
    resolvePropertyKey(opts.rootMetadata.fields, column),
  );
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
  const { rows } = await opts.client.query(compiled.text, compiled.params);

  const foreignRows = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const pkVal = foreignPkKeys
      .map((k) => {
        const colName = resolveColumnNameSafe(foreignMeta.fields, k);
        return String((row as any)[colName] ?? "");
      })
      .join("|");
    if (!foreignRows.has(pkVal)) foreignRows.set(pkVal, []);
    foreignRows.get(pkVal)!.push(row as Dict);
  }

  for (const [fkKey, ownerEntities] of fkToEntities) {
    const matchedRows = foreignRows.get(fkKey) ?? [];
    const hydrated = matchedRows.map((row) =>
      hydrateRow(row, foreignMeta, projection, opts.amphora),
    );

    for (const entity of ownerEntities) {
      (entity as any)[include.relation] = isCollection ? hydrated : (hydrated[0] ?? null);
    }
  }
};

const executeInverseInclude = async <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("../../../../entity/types/metadata.js").MetaRelation,
  foreignMeta: EntityMetadata,
  isCollection: boolean,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): Promise<void> => {
  const projection = includeProjection(include, relation, foreignMeta, queryStitchKeys);

  const localPkKeys = Object.values(relation.findKeys!).map((column) =>
    resolvePropertyKey(opts.rootMetadata.fields, column),
  );
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
  const { rows } = await opts.client.query(compiled.text, compiled.params);

  const grouped = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const fkVal = foreignFkKeys
      .map((k) => {
        const colName = resolveColumnNameSafe(foreignMeta.fields, k);
        return String((row as any)[colName] ?? "");
      })
      .join("|");
    if (!grouped.has(fkVal)) grouped.set(fkVal, []);
    grouped.get(fkVal)!.push(row as Dict);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const matchedRows = grouped.get(pkKey) ?? [];
    const hydrated = matchedRows.map((row) =>
      hydrateRow(row, foreignMeta, projection, opts.amphora),
    );

    for (const entity of ownerEntities) {
      (entity as any)[include.relation] = isCollection ? hydrated : (hydrated[0] ?? null);
    }
  }
};

const executeManyToManyInclude = async <E extends IEntity>(
  entities: Array<E>,
  include: IncludeSpec,
  relation: import("../../../../entity/types/metadata.js").MetaRelation,
  foreignMeta: EntityMetadata,
  ctx: RelationQueryContext,
  opts: ExecuteQueryIncludesOptions,
): Promise<void> => {
  const projection = includeProjection(include, relation, foreignMeta, queryStitchKeys);

  const joinKeys = relation.joinKeys!;
  const localPkKeys = Object.values(joinKeys).map((column) =>
    resolvePropertyKey(opts.rootMetadata.fields, column),
  );
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
  const { rows } = await opts.client.query(compiled.text, compiled.params);

  const grouped = new Map<string, Array<Dict>>();
  for (const row of rows) {
    const rootPkVal = joinTableCols
      .map((col) => String((row as any)[`__jt_${col}`] ?? ""))
      .join("|");
    if (!grouped.has(rootPkVal)) grouped.set(rootPkVal, []);
    grouped.get(rootPkVal)!.push(row as Dict);
  }

  for (const [pkKey, ownerEntities] of pkToEntities) {
    const matchedRows = grouped.get(pkKey) ?? [];
    const hydrated = matchedRows.map((row) =>
      hydrateRow(row, foreignMeta, projection, opts.amphora),
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
  projection: IncludeProjection | null,
  amphora?: IAmphora,
): Dict => {
  const dict = extractFieldDictFromReturning(row, metadata);
  const effectiveMeta = resolvePolymorphicMetadata(dict, metadata);

  const entity = defaultHydrateEntity(
    dict,
    restrictToProjection(effectiveMeta, projection),
    {
      snapshot: false,
      hooks: false,
      amphora,
    },
  );

  // The keys that matched this row back to its root are the driver’s own; the
  // caller gets the columns it named and nothing else.
  clearImplicitKeys(entity, projection);

  return entity;
};
