import type { ILogger } from "@lindorm/logger";
import { QueryBuilder } from "../../../../classes/QueryBuilder";
import { ProteusError } from "../../../../errors";
import type {
  IDeleteQueryBuilder,
  IEntity,
  IInsertQueryBuilder,
  IProteusQueryBuilder,
  IUpdateQueryBuilder,
} from "../../../../interfaces";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type {
  SetOperationType,
  SqlFragment,
  SubqueryPredicateSpec,
} from "../../../types/query";
import type { SqliteQueryClient } from "../types/sqlite-query-client";
import { compileAggregate, type AggregateType } from "../utils/query/compile-aggregate";
import {
  compileQuery,
  compileCount,
  type CompiledQuery,
} from "../utils/query/compile-query";
import { executeQueryIncludes } from "../utils/query/execute-query-includes";
import { hydrateRows } from "../utils/query/hydrate-result";
import { partitionIncludes } from "../utils/query/partition-includes";
import { warnCartesianIncludes } from "../utils/query/warn-cartesian-includes";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections";
import { SqliteInsertQueryBuilder } from "./SqliteInsertQueryBuilder";
import { SqliteUpdateQueryBuilder } from "./SqliteUpdateQueryBuilder";
import { SqliteDeleteQueryBuilder } from "./SqliteDeleteQueryBuilder";

export class SqliteQueryBuilder<E extends IEntity> extends QueryBuilder<E> {
  private readonly client: SqliteQueryClient;
  private readonly namespace: string | null;
  private readonly logger: ILogger | null;

  public constructor(
    metadata: EntityMetadata,
    client: SqliteQueryClient,
    namespace?: string | null,
    logger?: ILogger | null,
  ) {
    super(metadata);
    this.client = client;
    this.namespace = namespace ?? null;
    this.logger = logger ?? null;
  }

  public toSQL(): CompiledQuery {
    return this.buildQuery();
  }

  // --- Subquery predicates ---

  public whereInQuery<F extends IEntity>(
    field: keyof E,
    subqueryBuilder: SqliteQueryBuilder<F>,
    subqueryField: keyof F,
  ): this {
    this.state.subqueryPredicates = [];
    this.pushSubqueryPredicate("in", "and", field, subqueryBuilder, subqueryField);
    return this;
  }

  public andWhereInQuery<F extends IEntity>(
    field: keyof E,
    subqueryBuilder: SqliteQueryBuilder<F>,
    subqueryField: keyof F,
  ): this {
    this.pushSubqueryPredicate("in", "and", field, subqueryBuilder, subqueryField);
    return this;
  }

  public whereNotInQuery<F extends IEntity>(
    field: keyof E,
    subqueryBuilder: SqliteQueryBuilder<F>,
    subqueryField: keyof F,
  ): this {
    this.state.subqueryPredicates = [];
    this.pushSubqueryPredicate("nin", "and", field, subqueryBuilder, subqueryField);
    return this;
  }

  public whereExists(subqueryBuilder: SqliteQueryBuilder<any>): this {
    this.state.subqueryPredicates = [];
    const compiled = this.compileStrippedSubquery(subqueryBuilder);
    this.state.subqueryPredicates.push({
      type: "exists",
      sql: compiled.text,
      params: [...compiled.params],
      conjunction: "and",
    });
    return this;
  }

  public whereNotExists(subqueryBuilder: SqliteQueryBuilder<any>): this {
    this.state.subqueryPredicates = [];
    const compiled = this.compileStrippedSubquery(subqueryBuilder);
    this.state.subqueryPredicates.push({
      type: "notExists",
      sql: compiled.text,
      params: [...compiled.params],
      conjunction: "and",
    });
    return this;
  }

  // --- CTEs ---

  public withCte(
    name: string,
    input: SqliteQueryBuilder<any> | SqlFragment,
    options?: { materialized?: boolean },
  ): this {
    if (this.state.ctes.some((c) => c.name === name)) {
      throw new ProteusError(`CTE "${name}" already defined on this query`);
    }

    let sql: string;
    let params: Array<unknown>;

    if (input instanceof SqliteQueryBuilder) {
      const compiled = input.toSQL();
      sql = compiled.text;
      params = [...compiled.params];
    } else {
      sql = input.sql;
      params = [...input.params];
    }

    this.state.ctes.push({
      name,
      sql,
      params,
      materialized: options?.materialized ?? null,
    });
    return this;
  }

  public fromCte(name: string): this {
    if (!this.state.ctes.some((c) => c.name === name)) {
      throw new ProteusError(
        `CTE "${name}" not defined. Define it with .withCte("${name}", ...) first.`,
      );
    }
    this.state.cteFrom = name;
    return this;
  }

  // --- Set operations ---

  public union(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("UNION", other);
  }

  public unionAll(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("UNION ALL", other);
  }

  public intersect(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("INTERSECT", other);
  }

  public intersectAll(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("INTERSECT ALL", other);
  }

  public except(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("EXCEPT", other);
  }

  public exceptAll(other: SqliteQueryBuilder<E>): this {
    return this.addSetOperation("EXCEPT ALL", other);
  }

  // --- IProteusQueryBuilder overrides ---

  public toQuery(): unknown {
    return this.toSQL();
  }

  public clone(): IProteusQueryBuilder<E> {
    const cloned = new SqliteQueryBuilder<E>(
      this.metadata,
      this.client,
      this.namespace,
      this.logger,
    );
    cloned.state = this.cloneState();
    return cloned;
  }

  public async getOne(): Promise<E | null> {
    const { joinIncludes, queryIncludes } = partitionIncludes(this.state.includes);

    if (this.logger) warnCartesianIncludes(joinIncludes, this.metadata, this.logger);

    const effectiveSelections = filterHiddenSelections(
      this.metadata,
      ["single"],
      this.state.selections as Array<string> | null,
    );

    const take = joinIncludes.length > 0 ? null : 1;
    const joinState = {
      ...this.state,
      includes: joinIncludes,
      take,
      selections: effectiveSelections,
    };
    const query = compileQuery(joinState, this.metadata, this.namespace);

    const rows = this.client.all(query.text, query.params);
    if (rows.length === 0) return null;

    const entities = hydrateRows<E>(rows, this.metadata, query.aliasMap, joinIncludes);
    if (entities.length === 0) return null;

    if (queryIncludes.length > 0) {
      executeQueryIncludes([entities[0]], queryIncludes, {
        rootMetadata: this.metadata,
        client: this.client,
        namespace: this.namespace,
        withDeleted: this.state.withDeleted,
        versionTimestamp: this.state.versionTimestamp,
      });
    }

    return entities[0];
  }

  public async getOneOrFail(): Promise<E> {
    const entity = await this.getOne();
    if (!entity) {
      throw new ProteusError(`Expected entity "${this.metadata.entity.name}" not found`);
    }
    return entity;
  }

  public async getMany(): Promise<Array<E>> {
    const { joinIncludes, queryIncludes } = partitionIncludes(this.state.includes);

    if (this.logger) warnCartesianIncludes(joinIncludes, this.metadata, this.logger);

    const effectiveSelections = filterHiddenSelections(
      this.metadata,
      ["multiple"],
      this.state.selections as Array<string> | null,
    );

    const joinState = {
      ...this.state,
      includes: joinIncludes,
      selections: effectiveSelections,
    };
    const query = compileQuery(joinState, this.metadata, this.namespace);
    const rows = this.client.all(query.text, query.params);
    const entities = hydrateRows<E>(rows, this.metadata, query.aliasMap, joinIncludes);

    if (queryIncludes.length > 0) {
      executeQueryIncludes(entities, queryIncludes, {
        rootMetadata: this.metadata,
        client: this.client,
        namespace: this.namespace,
        withDeleted: this.state.withDeleted,
        versionTimestamp: this.state.versionTimestamp,
      });
    }

    return entities;
  }

  public async getManyAndCount(): Promise<[Array<E>, number]> {
    const entities = await this.getMany();
    const countResult = await this.executeCount();
    return [entities, countResult];
  }

  public async count(): Promise<number> {
    return this.executeCount();
  }

  public async exists(): Promise<boolean> {
    const count = await this.executeCount();
    return count > 0;
  }

  // --- Raw result terminal ---

  public async getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>> {
    const query = this.buildQuery();
    return this.client.all(query.text, query.params) as Array<T>;
  }

  // --- Aggregate terminal methods ---

  public async sum(field: keyof E): Promise<number | null> {
    return this.executeAggregate("SUM", field);
  }

  public async average(field: keyof E): Promise<number | null> {
    return this.executeAggregate("AVG", field);
  }

  public async minimum(field: keyof E): Promise<number | null> {
    return this.executeAggregate("MIN", field);
  }

  public async maximum(field: keyof E): Promise<number | null> {
    return this.executeAggregate("MAX", field);
  }

  // --- Write builders ---

  public insert(): IInsertQueryBuilder<E> {
    return new SqliteInsertQueryBuilder<E>(this.metadata, this.client, this.namespace);
  }

  public update(): IUpdateQueryBuilder<E> {
    this.guardAppendOnlyWrite("update");
    return new SqliteUpdateQueryBuilder<E>(this.metadata, this.client, this.namespace);
  }

  public delete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("delete");
    return new SqliteDeleteQueryBuilder<E>(
      this.metadata,
      this.client,
      this.namespace,
      false,
    );
  }

  public softDelete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("softDelete");
    return new SqliteDeleteQueryBuilder<E>(
      this.metadata,
      this.client,
      this.namespace,
      true,
    );
  }

  // --- Private ---

  private pushSubqueryPredicate<F extends IEntity>(
    type: "in" | "nin",
    conjunction: "and" | "or",
    field: keyof E,
    subqueryBuilder: SqliteQueryBuilder<F>,
    subqueryField: keyof F,
  ): void {
    const subMeta = subqueryBuilder.metadata;
    const subFieldMeta = subMeta.fields.find((f) => f.key === (subqueryField as string));
    if (!subFieldMeta) {
      throw new ProteusError(
        `Field "${String(subqueryField)}" not found on subquery entity "${subMeta.entity.name}"`,
      );
    }

    const subState = { ...subqueryBuilder.state };
    subState.selections = [subqueryField] as Array<keyof F>;
    subState.includes = [];
    subState.rawSelections = [];
    subState.windows = [];
    subState.ctes = [];
    subState.cteFrom = null;
    subState.orderBy = null;
    subState.skip = null;
    subState.setOperations = [];

    const recompiled = compileQuery(subState, subMeta, subqueryBuilder.namespace);

    this.state.subqueryPredicates.push({
      type,
      field: field as string,
      sql: recompiled.text,
      params: [...recompiled.params],
      conjunction,
    } as SubqueryPredicateSpec);
  }

  private compileStrippedSubquery(
    subqueryBuilder: SqliteQueryBuilder<any>,
  ): CompiledQuery {
    const subState = { ...subqueryBuilder.state };
    subState.windows = [];
    subState.rawSelections = [];
    subState.orderBy = null;
    subState.skip = null;
    subState.ctes = [];
    subState.cteFrom = null;
    subState.setOperations = [];

    return compileQuery(subState, subqueryBuilder.metadata, subqueryBuilder.namespace);
  }

  private addSetOperation(
    operation: SetOperationType,
    other: SqliteQueryBuilder<E>,
  ): this {
    if (other.state.ctes.length > 0) {
      throw new ProteusError(
        `Cannot use ${operation} with a query that has CTEs. Define CTEs on the primary query instead.`,
      );
    }

    const compiled = other.toSQL();
    this.state.setOperations.push({
      operation,
      sql: compiled.text,
      params: [...compiled.params],
    });
    return this;
  }

  private async executeAggregate(
    type: AggregateType,
    field: keyof E,
  ): Promise<number | null> {
    const { text, params } = compileAggregate(
      type,
      field,
      this.state,
      this.metadata,
      this.namespace,
    );
    const row = this.client.get(text, params);
    const raw = (row as any)?.result;
    return raw != null ? Number(raw) : null;
  }

  private buildQuery(): CompiledQuery {
    const { joinIncludes } = partitionIncludes(this.state.includes);
    return compileQuery(
      { ...this.state, includes: joinIncludes },
      this.metadata,
      this.namespace,
    );
  }

  private async executeCount(): Promise<number> {
    const { joinIncludes } = partitionIncludes(this.state.includes);
    const compiled = compileCount(
      { ...this.state, includes: joinIncludes },
      this.metadata,
      this.namespace,
    );
    const row = this.client.get(compiled.text, compiled.params);
    return parseInt(String((row as any)?.count ?? "0"), 10);
  }
}
