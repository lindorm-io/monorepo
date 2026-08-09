import type { Document } from "mongodb";
import type { EntityMetadata, MetaRelation } from "../../../../entity/types/metadata.js";
import type { IncludeSpec } from "../../../../types/query.js";
import {
  findRelationByKey,
  getRelationMetadata,
} from "../../../../utils/query/get-relation-metadata.js";
import {
  includeProjection,
  joinStitchKeys,
} from "../../../../utils/query/include-projection.js";
import { compileProjection } from "../compile-projection.js";
import { compileSort } from "../compile-sort.js";
import { resolveCollectionName } from "../resolve-collection-name.js";
import { compileRelationFilter } from "./compile-relation-filter.js";
import {
  isJoinTableRelation,
  resolveManyToManyJoin,
  resolveRelationJoin,
} from "./resolve-relation-join.js";

export type IncludeLookupContext = {
  rootMetadata: EntityMetadata;
  withDeleted: boolean;
  versionTimestamp: Date | null;
};

/**
 * Where a `$lookup` parks its matches on the root document.
 *
 * A relation is a PROPERTY key and a document is keyed by COLUMN names, so the
 * two can collide; the prefix keeps the lookup output out of the root's own
 * fields and makes it trivial to strip again after hydration.
 */
export const relationAlias = (relation: string): string => `__rel_${relation}`;

/**
 * The `$lookup` stages one relation contributes to the root pipeline.
 *
 * `$lookup` always produces an ARRAY, which is the to-many shape already; a
 * to-one collapses to its first element (or `null`) when the relation is
 * attached, so the pipeline itself stays one shape.
 *
 * `required` is INNER-join semantics, and on an array that is exactly "the
 * lookup found something": `{ "<as>.0": { $exists: true } }`. That is the same
 * predicate `$unwind` with `preserveNullAndEmptyArrays: false` applies — but
 * unwinding fans a to-many root out into one document per relation row and
 * would then have to be grouped back together, so the match is used directly.
 * An optional relation adds no stage at all, which is the LEFT-join half.
 *
 * `minimal` builds the pipeline that only has to decide whether a root survives
 * — counting and existence — so the relation is cut to a single row and neither
 * ordered nor projected.
 */
export const compileIncludeLookup = (
  include: IncludeSpec,
  ctx: IncludeLookupContext,
  minimal = false,
): Array<Document> => {
  const relation = findRelationByKey(ctx.rootMetadata, include.relation);
  const foreignMetadata = getRelationMetadata(relation);
  const alias = relationAlias(include.relation);

  const filter = compileRelationFilter(include, foreignMetadata, ctx);
  const projection = includeProjection(
    include,
    relation,
    foreignMetadata,
    joinStitchKeys,
  );

  const projected = projection
    ? compileProjection(projection.keys, foreignMetadata)
    : undefined;

  const tail: Array<Document> = minimal
    ? [{ $limit: 1 }]
    : [
        ...(relation.orderBy
          ? [{ $sort: compileSort(relation.orderBy, foreignMetadata) as Document }]
          : []),
        ...(projected ? [{ $project: projected }] : []),
      ];

  const lookup = isJoinTableRelation(relation)
    ? compileManyToManyLookup(relation, ctx, foreignMetadata, alias, filter, tail)
    : compilePlainLookup(relation, ctx, foreignMetadata, alias, filter, tail);

  return [
    ...lookup,
    ...(include.required ? [{ $match: { [`${alias}.0`]: { $exists: true } } }] : []),
  ];
};

/**
 * A relation matched on foreign-key columns: one hop, one sub-pipeline.
 *
 * The `$ne … null` guards are not decoration — `$eq` inside `$expr` treats a
 * missing field and a null one as equal, so without them a root with no foreign
 * key would match every foreign row that has none either.
 */
const compilePlainLookup = (
  relation: MetaRelation,
  ctx: IncludeLookupContext,
  foreignMetadata: EntityMetadata,
  alias: string,
  filter: Document | null,
  tail: Array<Document>,
): Array<Document> => {
  const pairs = resolveRelationJoin(relation, ctx.rootMetadata, foreignMetadata);

  const variables: Document = {};
  const expressions: Array<Document> = [];

  pairs.forEach((pair, index) => {
    const variable = `rel${index}`;
    variables[variable] = `$${pair.localDoc}`;
    expressions.push(
      { $eq: [`$${pair.foreignDoc}`, `$$${variable}`] },
      { $ne: [`$$${variable}`, null] },
      { $ne: [`$${pair.foreignDoc}`, null] },
    );
  });

  return [
    {
      $lookup: {
        from: resolveCollectionName(foreignMetadata),
        let: variables,
        pipeline: [
          { $match: { $expr: { $and: expressions } } },
          ...(filter ? [{ $match: filter }] : []),
          ...tail,
        ],
        as: alias,
      },
    },
  ];
};

/**
 * A many-to-many: the join collection is looked up from the root, and each join
 * document looks the foreign document up in turn, so the whole relation is still
 * one round trip.
 *
 * The inner `$unwind` has no `preserveNullAndEmptyArrays`, and that is the
 * point: a join row whose target is gone — deleted, filtered out by the
 * relation's own `where` — must disappear rather than leave a hole, which is the
 * inner join between the join table and the foreign table.
 */
const compileManyToManyLookup = (
  relation: MetaRelation,
  ctx: IncludeLookupContext,
  foreignMetadata: EntityMetadata,
  alias: string,
  filter: Document | null,
  tail: Array<Document>,
): Array<Document> => {
  const join = resolveManyToManyJoin(relation, ctx.rootMetadata, foreignMetadata);
  if (!join) return [{ $set: { [alias]: [] } }];

  const rootVariables: Document = {};
  const rootExpressions: Array<Document> = [];

  join.root.forEach((entry, index) => {
    const variable = `root${index}`;
    rootVariables[variable] = `$${entry.localDoc}`;
    rootExpressions.push(
      { $eq: [`$${entry.joinColumn}`, `$$${variable}`] },
      { $ne: [`$$${variable}`, null] },
    );
  });

  const foreignVariables: Document = {};
  const foreignExpressions: Array<Document> = [];

  join.foreign.forEach((entry, index) => {
    const variable = `link${index}`;
    foreignVariables[variable] = `$${entry.joinColumn}`;
    foreignExpressions.push(
      { $eq: [`$${entry.foreignDoc}`, `$$${variable}`] },
      { $ne: [`$$${variable}`, null] },
    );
  });

  return [
    {
      $lookup: {
        from: join.collection,
        let: rootVariables,
        pipeline: [
          { $match: { $expr: { $and: rootExpressions } } },
          {
            $lookup: {
              from: resolveCollectionName(foreignMetadata),
              let: foreignVariables,
              pipeline: [
                { $match: { $expr: { $and: foreignExpressions } } },
                ...(filter ? [{ $match: filter }] : []),
              ],
              as: "__link",
            },
          },
          { $unwind: "$__link" },
          { $replaceRoot: { newRoot: "$__link" } },
          ...tail,
        ],
        as: alias,
      },
    },
  ];
};
