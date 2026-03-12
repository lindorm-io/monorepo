import type { Document } from "mongodb";
import type { IEntity } from "../../../../interfaces";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import type { PredicateEntry } from "#internal/types/query";
import { compileFilter } from "./compile-filter";
import { compileSort } from "./compile-sort";

/**
 * Parsed aggregate selection: "SUM(amount)" -> { fn: "$sum", field: "amount" }
 */
export type AggregateSelection = {
  fn: string;
  field: string;
  alias: string;
};

/**
 * Resolve the MongoDB field name for a given entity field key.
 * PK fields map to _id, all others use the metadata name.
 */
const resolveMongoFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  if (metadata.primaryKeys.includes(fieldKey)) return "_id";
  const field = metadata.fields.find((f) => f.key === fieldKey);
  return field?.name ?? fieldKey;
};

/**
 * Compile predicates into a single MongoDB filter, merging AND/OR conditions.
 */
export const compilePredicatesToFilter = <E extends IEntity>(
  predicates: Array<PredicateEntry<E>>,
  metadata: EntityMetadata,
): Document => {
  if (predicates.length === 0) return {};

  const andConditions: Array<Document> = [];
  const orConditions: Array<Document> = [];

  for (const entry of predicates) {
    const compiled = compileFilter(entry.predicate, metadata);
    if (Object.keys(compiled).length === 0) continue;

    if (entry.conjunction === "or") {
      orConditions.push(compiled);
    } else {
      andConditions.push(compiled);
    }
  }

  if (orConditions.length === 0) {
    if (andConditions.length === 0) return {};
    if (andConditions.length === 1) return andConditions[0];
    return { $and: andConditions };
  }

  // If we have both AND and OR conditions:
  // The AND conditions form the base, OR conditions are alternatives
  const baseFilter =
    andConditions.length === 0
      ? {}
      : andConditions.length === 1
        ? andConditions[0]
        : { $and: andConditions };

  // OR: match base AND (any OR predicate)
  if (Object.keys(baseFilter).length === 0) {
    return orConditions.length === 1 ? orConditions[0] : { $or: orConditions };
  }

  return {
    $or: [baseFilter, ...orConditions],
  };
};

/**
 * Build the aggregation pipeline for GROUP BY / aggregate queries.
 *
 * Pipeline stages:
 * 1. $match — filter from where() predicates + system filters
 * 2. $group — group by fields + aggregate accumulators
 * 3. $match — having conditions (filter on aggregated values)
 * 4. $sort — ordering
 * 5. $skip — pagination offset
 * 6. $limit — result limit
 * 7. $project — field selection (rename _id components back to field names)
 */
export const compileAggregationPipeline = <E extends IEntity>(options: {
  filter: Document;
  groupByFields: Array<keyof E>;
  aggregateSelections: Array<AggregateSelection>;
  having: Array<PredicateEntry<E>>;
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null;
  skip: number | null;
  take: number | null;
  metadata: EntityMetadata;
}): Array<Document> => {
  const {
    filter,
    groupByFields,
    aggregateSelections,
    having,
    orderBy,
    skip,
    take,
    metadata,
  } = options;

  const pipeline: Array<Document> = [];

  // Stage 1: $match
  if (Object.keys(filter).length > 0) {
    pipeline.push({ $match: filter });
  }

  // Stage 2: $group
  const groupId: Document = {};
  for (const fieldKey of groupByFields) {
    const mongoField = resolveMongoFieldName(fieldKey as string, metadata);
    groupId[fieldKey as string] = `$${mongoField}`;
  }

  const groupStage: Document = {
    _id: Object.keys(groupId).length > 0 ? groupId : null,
  };

  for (const agg of aggregateSelections) {
    const mongoField = resolveMongoFieldName(agg.field, metadata);
    if (agg.fn === "$sum" && agg.field === "*") {
      // COUNT(*)
      groupStage[agg.alias] = { $sum: 1 };
    } else {
      groupStage[agg.alias] = { [agg.fn]: `$${mongoField}` };
    }
  }

  pipeline.push({ $group: groupStage });

  // Stage 3: $match for HAVING
  if (having.length > 0) {
    const havingFilter = compilePredicatesToFilter(having, metadata);
    if (Object.keys(havingFilter).length > 0) {
      pipeline.push({ $match: havingFilter });
    }
  }

  // Stage 4: $sort
  if (orderBy) {
    const sort = compileSort(orderBy as Record<string, "ASC" | "DESC">, metadata);
    if (sort) {
      pipeline.push({ $sort: sort });
    }
  }

  // Stage 5: $skip
  if (skip != null && skip > 0) {
    pipeline.push({ $skip: skip });
  }

  // Stage 6: $limit
  if (take != null) {
    pipeline.push({ $limit: take });
  }

  // Stage 7: $project — expose group-by fields from _id
  const project: Document = { _id: 0 };
  for (const fieldKey of groupByFields) {
    project[fieldKey as string] = `$_id.${fieldKey as string}`;
  }
  for (const agg of aggregateSelections) {
    project[agg.alias] = 1;
  }
  if (Object.keys(project).length > 1) {
    pipeline.push({ $project: project });
  }

  return pipeline;
};
