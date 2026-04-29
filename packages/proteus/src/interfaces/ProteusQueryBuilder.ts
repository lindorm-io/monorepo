import type { Dict, Predicate } from "@lindorm/types";
import type { IncludeOptions, SqlFragment, WindowSpec } from "../internal/types/query.js";
import type { IDeleteQueryBuilder } from "./DeleteQueryBuilder.js";
import type { IEntity } from "./Entity.js";
import type { IInsertQueryBuilder } from "./InsertQueryBuilder.js";
import type { IUpdateQueryBuilder } from "./UpdateQueryBuilder.js";

/**
 * Fluent query builder for constructing complex read and write queries.
 *
 * Obtained via `repository.queryBuilder()` or `transactionCtx.queryBuilder(MyEntity)`.
 * Builder methods return `this` for chaining. Terminal methods execute the query.
 */
export interface IProteusQueryBuilder<E extends IEntity> {
  // Filtering

  /** Set the WHERE clause using a predicate object. */
  where(criteria: Predicate<E>): this;
  /** Append an AND condition to the WHERE clause. */
  andWhere(criteria: Predicate<E>): this;
  /** Append an OR condition to the WHERE clause. */
  orWhere(criteria: Predicate<E>): this;

  // Raw WHERE

  /** Set the WHERE clause using a raw SQL fragment. */
  whereRaw(fragment: SqlFragment): this;
  /** Append a raw AND condition to the WHERE clause. */
  andWhereRaw(fragment: SqlFragment): this;
  /** Append a raw OR condition to the WHERE clause. */
  orWhereRaw(fragment: SqlFragment): this;

  // Relations

  /** Eagerly load a relation into the result set. */
  include(relation: string, options?: IncludeOptions): this;

  // Projection

  /** Select specific fields to return (projection). */
  select(...fields: Array<keyof E>): this;
  /** Add a raw SQL expression as a selected column with the given alias. */
  selectRaw(fragment: SqlFragment, alias: string): this;
  /** Return only distinct rows. */
  distinct(): this;

  // GROUP BY + HAVING

  /** Group results by one or more fields. */
  groupBy(...fields: Array<keyof E>): this;
  /** Set the HAVING clause using a predicate object. */
  having(criteria: Predicate<E>): this;
  /** Append an AND condition to the HAVING clause. */
  andHaving(criteria: Predicate<E>): this;
  /** Append an OR condition to the HAVING clause. */
  orHaving(criteria: Predicate<E>): this;
  /** Set the HAVING clause using a raw SQL fragment. */
  havingRaw(fragment: SqlFragment): this;
  /** Append a raw AND condition to the HAVING clause. */
  andHavingRaw(fragment: SqlFragment): this;
  /** Append a raw OR condition to the HAVING clause. */
  orHavingRaw(fragment: SqlFragment): this;

  // Window functions

  /** Define a window function specification for analytic queries. */
  window(spec: WindowSpec<E>): this;

  // Ordering + Pagination

  /** Set the sort order for results. */
  orderBy(order: Partial<Record<keyof E, "ASC" | "DESC">>): this;
  /** Skip the first N results (offset). */
  skip(offset: number): this;
  /** Limit the result set to N rows. */
  take(limit: number): this;

  // Soft-delete

  /** Include soft-deleted entities in the results. */
  withDeleted(): this;

  // Scope

  /** Bypass the automatic scope filter for this query. */
  withoutScope(): this;

  // @Filter overrides

  /**
   * Opt-in to a named `@Filter` for this query, with optional parameter overrides.
   *
   * - `setFilter("tenant", { tenantId: "abc" })` — enable with params
   * - `setFilter("tenant", true)` — enable with source-registered params
   * - `setFilter("tenant", false)` — disable (even if default-on)
   */
  setFilter(name: string, params?: boolean | Dict<unknown>): this;

  // Version filtering

  /** Query the entity table as of the given timestamp (temporal/versioned tables). */
  versionAt(timestamp: Date): this;
  /** Include all historical versions in the results (temporal/versioned tables). */
  withAllVersions(): this;

  // Cloning

  /** Create a deep copy of this query builder for reuse or branching. */
  clone(): IProteusQueryBuilder<E>;

  // Debug

  /** Return the compiled query for debugging (driver-specific format). */
  toQuery(): unknown;

  // Terminal methods (read-only)

  /** Execute the query and return the first matching entity, or `null`. */
  getOne(): Promise<E | null>;
  /** Execute the query and return the first matching entity. Throws if none exists. */
  getOneOrFail(): Promise<E>;
  /** Execute the query and return all matching entities. */
  getMany(): Promise<Array<E>>;
  /** Execute the query and return all matching entities alongside the total count. */
  getManyAndCount(): Promise<[Array<E>, number]>;
  /** Execute the query and return the count of matching entities. */
  count(): Promise<number>;
  /** Execute the query and return whether any matching entity exists. */
  exists(): Promise<boolean>;

  // Raw result terminal

  /** Execute the query and return raw database rows without hydration. */
  getRawRows<T extends Record<string, unknown> = Record<string, unknown>>(): Promise<
    Array<T>
  >;

  // Aggregate terminal methods

  /** Compute the sum of a numeric field across matching rows. */
  sum(field: keyof E): Promise<number | null>;
  /** Compute the average of a numeric field across matching rows. */
  average(field: keyof E): Promise<number | null>;
  /** Find the minimum value of a field across matching rows. */
  minimum(field: keyof E): Promise<number | null>;
  /** Find the maximum value of a field across matching rows. */
  maximum(field: keyof E): Promise<number | null>;

  // Write builders — raw SQL, no hooks/cascades/version checks

  /** Create a raw INSERT builder. Bypasses ORM lifecycle (hooks, cascades, validation). */
  insert(): IInsertQueryBuilder<E>;
  /** Create a raw UPDATE builder. Bypasses ORM lifecycle (hooks, cascades, version checks). */
  update(): IUpdateQueryBuilder<E>;
  /** Create a raw DELETE builder. Bypasses ORM lifecycle (hooks, cascades). */
  delete(): IDeleteQueryBuilder<E>;
  /** Create a raw soft-DELETE builder that sets the delete date. Bypasses ORM lifecycle. */
  softDelete(): IDeleteQueryBuilder<E>;
}
