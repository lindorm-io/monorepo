import type { Dict, Predicate } from "@lindorm/types";
import type { IEntity } from "../../interfaces/index.js";
import type { LockMode } from "../../types/find-options.js";
import type { RelationStrategy } from "../entity/types/metadata.js";
import type { ResolvedFilter } from "../utils/query/resolve-filters.js";

export type PredicateEntry<E extends IEntity> = {
  predicate: Predicate<E>;
  conjunction: "and" | "or";
};

export type IncludeOptions =
  | {
      required?: true;
      strategy?: "join";
      select?: Array<string>;
      where?: Predicate<Dict>;
    }
  | {
      required?: false;
      strategy?: RelationStrategy;
      select?: Array<string>;
      where?: Predicate<Dict>;
    };

export type IncludeSpec = {
  relation: string;
  required: boolean;
  strategy: RelationStrategy;
  select: Array<string> | null;
  where: Predicate<Dict> | null;
};

// --- Raw SQL ---

export type SqlFragment = {
  readonly __brand: "SqlFragment";
  readonly sql: string;
  readonly params: ReadonlyArray<unknown>;
};

export type RawSelectEntry = {
  expression: string;
  alias: string;
  params: Array<unknown>;
};

export type RawWhereEntry = {
  sql: string;
  params: Array<unknown>;
  conjunction: "and" | "or";
};

// --- Window Functions ---

export type WindowFunction =
  | "ROW_NUMBER"
  | "RANK"
  | "DENSE_RANK"
  | "NTILE"
  | "LAG"
  | "LEAD"
  | "FIRST_VALUE"
  | "LAST_VALUE"
  | "SUM"
  | "AVG"
  | "MIN"
  | "MAX"
  | "COUNT";

export type WindowSpec<E extends IEntity> = {
  fn: WindowFunction;
  args?: Array<keyof E | number>;
  partitionBy?: Array<keyof E>;
  orderBy?: Partial<Record<keyof E, "ASC" | "DESC">>;
  alias: string;
};

// --- CTEs ---

export type CteSpec = {
  name: string;
  sql: string;
  params: Array<unknown>;
  materialized: boolean | null;
};

// --- Subqueries ---

export type SubqueryPredicateSpec =
  | {
      type: "in" | "nin";
      field: string;
      sql: string;
      params: Array<unknown>;
      conjunction: "and" | "or";
    }
  | {
      type: "exists" | "notExists";
      sql: string;
      params: Array<unknown>;
      conjunction: "and" | "or";
    };

// --- Set Operations ---

export type SetOperationType =
  | "UNION"
  | "UNION ALL"
  | "INTERSECT"
  | "INTERSECT ALL"
  | "EXCEPT"
  | "EXCEPT ALL";

export type SetOperationEntry = {
  operation: SetOperationType;
  sql: string;
  params: Array<unknown>;
};

// --- QueryState ---

export type QueryState<E extends IEntity> = {
  predicates: Array<PredicateEntry<E>>;
  orderBy: Partial<Record<keyof E, "ASC" | "DESC">> | null;
  skip: number | null;
  take: number | null;
  includes: Array<IncludeSpec>;
  selections: Array<keyof E> | null;
  withDeleted: boolean;
  withoutScope: boolean;
  distinct: boolean;
  lock: LockMode | null;
  versionTimestamp: Date | null;
  withAllVersions: boolean;

  // S1: Raw SQL
  rawSelections: Array<RawSelectEntry>;
  rawWhere: Array<RawWhereEntry>;

  // S2: GROUP BY + HAVING
  groupBy: Array<keyof E> | null;
  having: Array<PredicateEntry<E>>;
  rawHaving: Array<RawWhereEntry>;

  // S3: Subqueries
  subqueryPredicates: Array<SubqueryPredicateSpec>;

  // S4: CTEs
  ctes: Array<CteSpec>;
  cteFrom: string | null;

  // S5: Window functions
  windows: Array<WindowSpec<E>>;

  // S6: Set operations
  setOperations: Array<SetOperationEntry>;

  // S7: User-defined @Filter predicates (resolved at query time)
  resolvedFilters: Array<ResolvedFilter>;

  // S8: Per-query @Filter overrides (from QB .setFilter() method)
  filterOverrides: Record<string, boolean | Dict<unknown>>;
};
