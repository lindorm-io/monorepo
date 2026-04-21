import type { Dict, Predicate } from "@lindorm/types";
import { ProteusError } from "../errors/index.js";
import type {
  IDeleteQueryBuilder,
  IEntity,
  IInsertQueryBuilder,
  IProteusQueryBuilder,
  IUpdateQueryBuilder,
} from "../interfaces/index.js";
import type { EntityMetadata } from "../internal/entity/types/metadata.js";
import type {
  IncludeOptions,
  QueryState,
  SqlFragment,
  WindowSpec,
} from "../internal/types/query.js";
import { resolveIncludeStrategy } from "../internal/utils/query/resolve-include-strategy.js";

/**
 * Abstract base class for fluent query builders.
 *
 * Provides the builder-pattern chaining methods (where, select, orderBy, etc.)
 * while delegating terminal execution (getOne, getMany, count, etc.) to
 * driver-specific subclasses.
 */
export abstract class QueryBuilder<E extends IEntity> implements IProteusQueryBuilder<E> {
  protected readonly metadata: EntityMetadata;
  protected state: QueryState<E>;

  public constructor(metadata: EntityMetadata) {
    this.metadata = metadata;
    this.state = createEmptyState<E>();
  }

  // --- Filtering ---

  /**
   * Sets the WHERE clause. Replaces any previously set predicates.
   * Use `.andWhere()` or `.orWhere()` to append additional conditions.
   */
  public where(criteria: Predicate<E>): this {
    this.state.predicates = [{ predicate: criteria, conjunction: "and" }];
    this.state.subqueryPredicates = [];
    this.state.rawWhere = [];
    return this;
  }

  public andWhere(criteria: Predicate<E>): this {
    this.state.predicates.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orWhere(criteria: Predicate<E>): this {
    this.state.predicates.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  // --- Raw WHERE ---

  public whereRaw(fragment: SqlFragment): this {
    this.state.rawWhere = [
      { sql: fragment.sql, params: [...fragment.params], conjunction: "and" },
    ];
    return this;
  }

  public andWhereRaw(fragment: SqlFragment): this {
    this.state.rawWhere.push({
      sql: fragment.sql,
      params: [...fragment.params],
      conjunction: "and",
    });
    return this;
  }

  public orWhereRaw(fragment: SqlFragment): this {
    this.state.rawWhere.push({
      sql: fragment.sql,
      params: [...fragment.params],
      conjunction: "or",
    });
    return this;
  }

  // --- Relations ---

  public include(relation: string, options?: IncludeOptions): this {
    const valid = this.metadata.relations.map((r) => r.key);
    if (!valid.includes(relation)) {
      throw new ProteusError(
        `Unknown relation "${relation}" on entity "${this.metadata.entity.name}". Valid relations: ${valid.join(", ") || "(none)"}`,
      );
    }

    // Fix I: Guard against duplicate includes
    if (this.state.includes.some((i) => i.relation === relation)) {
      throw new ProteusError(
        `Relation "${relation}" already included on entity "${this.metadata.entity.name}"`,
      );
    }

    const required = options?.required ?? false;

    this.state.includes.push({
      relation,
      required,
      strategy: required
        ? "join"
        : resolveIncludeStrategy(relation, this.metadata, options?.strategy),
      select: options?.select ?? null,
      where: options?.where ?? null,
    });
    return this;
  }

  // --- Projection ---

  public select(...fields: Array<keyof E>): this {
    const validKeys = this.metadata.fields.map((f) => f.key);
    for (const field of fields) {
      if (!validKeys.includes(field as string)) {
        throw new ProteusError(
          `Unknown field "${String(field)}" on entity "${this.metadata.entity.name}". Valid fields: ${validKeys.join(", ")}`,
        );
      }
    }

    this.state.selections = fields;
    return this;
  }

  public selectRaw(fragment: SqlFragment, alias: string): this {
    this.state.rawSelections.push({
      expression: fragment.sql,
      alias,
      params: [...fragment.params],
    });
    return this;
  }

  public distinct(): this {
    this.state.distinct = true;
    return this;
  }

  // --- GROUP BY + HAVING ---

  public groupBy(...fields: Array<keyof E>): this {
    this.state.groupBy = fields;
    return this;
  }

  public having(criteria: Predicate<E>): this {
    this.state.having = [{ predicate: criteria, conjunction: "and" }];
    return this;
  }

  public andHaving(criteria: Predicate<E>): this {
    this.state.having.push({ predicate: criteria, conjunction: "and" });
    return this;
  }

  public orHaving(criteria: Predicate<E>): this {
    this.state.having.push({ predicate: criteria, conjunction: "or" });
    return this;
  }

  public havingRaw(fragment: SqlFragment): this {
    this.state.rawHaving = [
      { sql: fragment.sql, params: [...fragment.params], conjunction: "and" },
    ];
    return this;
  }

  public andHavingRaw(fragment: SqlFragment): this {
    this.state.rawHaving.push({
      sql: fragment.sql,
      params: [...fragment.params],
      conjunction: "and",
    });
    return this;
  }

  public orHavingRaw(fragment: SqlFragment): this {
    this.state.rawHaving.push({
      sql: fragment.sql,
      params: [...fragment.params],
      conjunction: "or",
    });
    return this;
  }

  // --- Window functions ---

  public window(spec: WindowSpec<E>): this {
    this.state.windows.push(spec);
    return this;
  }

  // --- Ordering + Pagination ---

  public orderBy(order: Partial<Record<keyof E, "ASC" | "DESC">>): this {
    const validKeys = this.metadata.fields.map((f) => f.key);
    for (const key of Object.keys(order)) {
      if (!validKeys.includes(key)) {
        throw new ProteusError(
          `Unknown field "${key}" in orderBy on entity "${this.metadata.entity.name}". Valid fields: ${validKeys.join(", ")}`,
        );
      }
    }

    this.state.orderBy = order;
    return this;
  }

  public skip(offset: number): this {
    this.state.skip = offset;
    return this;
  }

  public take(limit: number): this {
    this.state.take = limit;
    return this;
  }

  // --- Soft-delete ---

  public withDeleted(): this {
    this.state.withDeleted = true;
    return this;
  }

  // --- Scope ---

  public withoutScope(): this {
    this.state.withoutScope = true;
    return this;
  }

  // --- @Filter overrides ---

  /**
   * Opt-in to a named `@Filter` for this query, with optional parameter overrides.
   *
   * - `setFilter("tenant", { tenantId: "abc" })` — enable with params
   * - `setFilter("tenant", true)` — enable with source-registered params
   * - `setFilter("tenant", false)` — disable (even if default-on)
   */
  public setFilter(name: string, params?: boolean | Dict<unknown>): this {
    this.state.filterOverrides[name] = params ?? true;
    return this;
  }

  // --- Version filtering ---

  public versionAt(timestamp: Date): this {
    this.state.versionTimestamp = timestamp;
    return this;
  }

  public withAllVersions(): this {
    this.state.withAllVersions = true;
    return this;
  }

  // --- Cloning ---

  public abstract clone(): IProteusQueryBuilder<E>;

  // --- Debug ---

  public abstract toQuery(): unknown;

  // --- Terminal methods ---

  public abstract getOne(): Promise<E | null>;
  public abstract getOneOrFail(): Promise<E>;
  public abstract getMany(): Promise<Array<E>>;
  public abstract getManyAndCount(): Promise<[Array<E>, number]>;
  public abstract count(): Promise<number>;
  public abstract exists(): Promise<boolean>;

  // Raw result terminal
  public abstract getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>>;

  // Aggregate terminal methods
  public abstract sum(field: keyof E): Promise<number | null>;
  public abstract average(field: keyof E): Promise<number | null>;
  public abstract minimum(field: keyof E): Promise<number | null>;
  public abstract maximum(field: keyof E): Promise<number | null>;

  // Write builders — raw SQL, no hooks/cascades/version checks
  public abstract insert(): IInsertQueryBuilder<E>;
  public abstract update(): IUpdateQueryBuilder<E>;
  public abstract delete(): IDeleteQueryBuilder<E>;
  public abstract softDelete(): IDeleteQueryBuilder<E>;

  // --- Protected helpers ---

  protected guardAppendOnlyWrite(method: string): void {
    if (this.metadata.appendOnly) {
      throw new ProteusError(
        `Cannot ${method} an append-only entity "${this.metadata.entity.name}" via query builder`,
        { debug: { entityName: this.metadata.entity.name, method } },
      );
    }
  }

  /**
   * Creates a shallow copy of the current state. Predicate objects are shared
   * by reference -- callers must treat predicates as immutable after cloning.
   */
  protected cloneState(): QueryState<E> {
    return {
      predicates: [...this.state.predicates],
      orderBy: this.state.orderBy ? { ...this.state.orderBy } : null,
      skip: this.state.skip,
      take: this.state.take,
      includes: this.state.includes.map((i) => ({ ...i })),
      selections: this.state.selections ? [...this.state.selections] : null,
      withDeleted: this.state.withDeleted,
      withoutScope: this.state.withoutScope,
      distinct: this.state.distinct,
      lock: this.state.lock,
      versionTimestamp: this.state.versionTimestamp,
      withAllVersions: this.state.withAllVersions,

      // S1: Raw SQL
      rawSelections: this.state.rawSelections.map((r) => ({
        ...r,
        params: [...r.params],
      })),
      rawWhere: this.state.rawWhere.map((r) => ({ ...r, params: [...r.params] })),

      // S2: GROUP BY + HAVING
      groupBy: this.state.groupBy ? [...this.state.groupBy] : null,
      having: [...this.state.having],
      rawHaving: this.state.rawHaving.map((r) => ({ ...r, params: [...r.params] })),

      // S3: Subqueries
      subqueryPredicates: this.state.subqueryPredicates.map((s) => ({
        ...s,
        params: [...s.params],
      })),

      // S4: CTEs
      ctes: this.state.ctes.map((c) => ({ ...c, params: [...c.params] })),
      cteFrom: this.state.cteFrom,

      // S5: Window functions
      windows: this.state.windows.map((w) => ({
        ...w,
        args: w.args ? [...w.args] : undefined,
        partitionBy: w.partitionBy ? [...w.partitionBy] : undefined,
        orderBy: w.orderBy ? { ...w.orderBy } : undefined,
      })),

      // S6: Set operations
      setOperations: this.state.setOperations.map((s) => ({
        ...s,
        params: [...s.params],
      })),

      // S7: User-defined @Filter predicates
      resolvedFilters: this.state.resolvedFilters.map((f) => ({ ...f })),

      // S8: Per-query @Filter overrides
      filterOverrides: { ...this.state.filterOverrides },
    };
  }
}

/** Create a fresh, empty QueryState with all collections initialized. */
export const createEmptyState = <E extends IEntity>(): QueryState<E> => ({
  predicates: [],
  orderBy: null,
  skip: null,
  take: null,
  includes: [],
  selections: null,
  withDeleted: false,
  withoutScope: false,
  distinct: false,
  lock: null,
  versionTimestamp: null,
  withAllVersions: false,

  // S1: Raw SQL
  rawSelections: [],
  rawWhere: [],

  // S2: GROUP BY + HAVING
  groupBy: null,
  having: [],
  rawHaving: [],

  // S3: Subqueries
  subqueryPredicates: [],

  // S4: CTEs
  ctes: [],
  cteFrom: null,

  // S5: Window functions
  windows: [],

  // S6: Set operations
  setOperations: [],

  // S7: User-defined @Filter predicates
  resolvedFilters: [],

  // S8: Per-query @Filter overrides
  filterOverrides: {},
});
