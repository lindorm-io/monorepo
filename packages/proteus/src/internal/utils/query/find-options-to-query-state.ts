import type { Predicate } from "@lindorm/types";
import type { IEntity } from "../../../interfaces";
import type { FindOptions } from "../../../types";
import type { EntityMetadata, QueryScope } from "../../entity/types/metadata";
import type { IncludeSpec, PredicateEntry, QueryState } from "../../types/query";
import type { FilterRegistry } from "./filter-registry";
import { mergeSystemFilterOverrides } from "./merge-system-filter-overrides";
import { resolveFilters } from "./resolve-filters";
import { resolveIncludeStrategy } from "./resolve-include-strategy";

export const findOptionsToQueryState = <E extends IEntity>(
  criteria: Predicate<E>,
  options: FindOptions<E>,
  metadata?: EntityMetadata,
  operationScope: QueryScope = "multiple",
  filterRegistry?: FilterRegistry,
): QueryState<E> => {
  const predicates: Array<PredicateEntry<E>> = [];

  if (Object.keys(criteria).length > 0) {
    predicates.push({ predicate: criteria, conjunction: "and" });
  }

  const take = options.limit ?? null;
  const skip = options.offset ?? null;

  const explicitRelations = new Set((options.relations ?? []).map((r) => r as string));

  const includes: Array<IncludeSpec> = [...explicitRelations].map((relation) => ({
    relation,
    required: false,
    strategy: metadata ? resolveIncludeStrategy(relation, metadata) : "join",
    select: null,
    where: null,
  }));

  // Auto-include eager relations from metadata
  if (metadata) {
    for (const rel of metadata.relations) {
      if (
        rel.options.loading[operationScope] === "eager" &&
        !explicitRelations.has(rel.key)
      ) {
        includes.push({
          relation: rel.key,
          required: false,
          strategy: resolveIncludeStrategy(rel.key, metadata),
          select: null,
          where: null,
        });
      }
    }
  }

  // Resolve ordering: explicit FindOptions.order > @DefaultOrder > null.
  // When user explicitly passes order: null to suppress ordering, we use {}
  // (empty object) as a sentinel so compileQuery's ?? fallback doesn't re-apply defaultOrder.
  const orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null =
    options.order !== undefined
      ? (options.order ?? ({} as Partial<Record<keyof E, "ASC" | "DESC">>))
      : metadata?.defaultOrder
        ? (metadata.defaultOrder as Partial<Record<keyof E, "ASC" | "DESC">>)
        : null;

  return {
    predicates,
    orderBy,
    skip,
    take,
    includes,
    selections: (options.select as Array<keyof E>) ?? null,
    withDeleted: options.withDeleted ?? false,
    distinct: options.distinct ?? false,
    lock: options.lock ?? null,
    versionTimestamp: options.versionTimestamp ?? null,
    withAllVersions: options.withAllVersions ?? false,

    // Phase 12 fields
    rawSelections: [],
    rawWhere: [],
    groupBy: null,
    having: [],
    rawHaving: [],
    subqueryPredicates: [],
    ctes: [],
    cteFrom: null,
    windows: [],
    setOperations: [],

    // S7: System + user-defined @Filter predicates
    resolvedFilters: metadata
      ? resolveFilters(
          metadata.filters,
          filterRegistry ?? new Map(),
          mergeSystemFilterOverrides(
            options.filters,
            options.withDeleted ?? false,
            options.withoutScope ?? false,
          ),
        )
      : [],

    // S8: Per-query @Filter overrides
    withoutScope: options.withoutScope ?? false,
    filterOverrides: {},
  };
};
