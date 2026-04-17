import type { IAmphora } from "@lindorm/amphora";
import type { ClientSession, Db, Document, Filter } from "mongodb";
import type { ILogger } from "@lindorm/logger";
import type {
  IDeleteQueryBuilder,
  IEntity,
  IInsertQueryBuilder,
  IProteusQueryBuilder,
  IUpdateQueryBuilder,
} from "../../../../interfaces";
import type { LockMode } from "../../../../types/find-options";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { FilterRegistry } from "../../../utils/query/filter-registry";
import type { AggregateSelection } from "../utils/compile-aggregation-pipeline";
import { QueryBuilder } from "../../../../classes/QueryBuilder";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import { generateAutoFilters } from "../../../entity/metadata/auto-filters";
import { resolveFilters } from "../../../utils/query/resolve-filters";
import { mergeSystemFilterOverrides } from "../../../utils/query/merge-system-filter-overrides";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria";
import { compileFilter } from "../utils/compile-filter";
import { compileSort } from "../utils/compile-sort";
import { compileProjection } from "../utils/compile-projection";
import { hydrateEntity, hydrateEntities } from "../utils/hydrate";
import {
  compileAggregationPipeline,
  compilePredicatesToFilter,
} from "../utils/compile-aggregation-pipeline";
import { MongoInsertQueryBuilder } from "./MongoInsertQueryBuilder";
import { MongoUpdateQueryBuilder } from "./MongoUpdateQueryBuilder";
import { MongoDeleteQueryBuilder } from "./MongoDeleteQueryBuilder";
import { resolveCollectionName as resolveBaseCollectionName } from "../utils/resolve-collection-name";

/**
 * Resolve the MongoDB field name for a given entity field key.
 * Single PK maps to _id; composite PK maps to _id.fieldKey.
 */
const resolveMongoFieldName = (fieldKey: string, metadata: EntityMetadata): string => {
  if (metadata.primaryKeys.includes(fieldKey)) {
    return metadata.primaryKeys.length === 1 ? "_id" : `_id.${fieldKey}`;
  }
  const field = metadata.fields.find((f) => f.key === fieldKey);
  return field?.name ?? fieldKey;
};

/**
 * MongoDB QueryBuilder implementation.
 *
 * Simple queries (where + orderBy + skip + take + select) use collection.find().
 * Complex queries (groupBy, having, aggregate functions) escalate to collection.aggregate().
 * Temporal queries (versionAt, withAllVersions) query the shadow collection.
 */
export class MongoQueryBuilder<E extends IEntity> extends QueryBuilder<E> {
  private readonly db: Db;
  private readonly namespace: string | null;
  private readonly logger: ILogger | undefined;
  private readonly filterRegistry: FilterRegistry;
  private readonly session: ClientSession | undefined;
  private readonly amphora: IAmphora | undefined;
  private aggregateSelections: Array<AggregateSelection> = [];

  public constructor(
    metadata: EntityMetadata,
    db: Db,
    namespace: string | null,
    logger?: ILogger,
    filterRegistry?: FilterRegistry,
    session?: ClientSession,
    amphora?: IAmphora,
  ) {
    super(metadata);
    this.db = db;
    this.namespace = namespace;
    this.logger = logger;
    this.filterRegistry = filterRegistry ?? new Map();
    this.session = session;
    this.amphora = amphora;
  }

  // ─── Lock mode ──────────────────────────────────────────────────────

  public lock(_mode: LockMode): this {
    throw new NotSupportedError("Lock mode is not supported by the MongoDB driver");
  }

  // ─── Override raw SQL methods to throw ─────────────────────────────

  public override whereRaw(): this {
    throw new NotSupportedError("whereRaw is not supported by the MongoDB driver");
  }

  public override andWhereRaw(): this {
    throw new NotSupportedError("andWhereRaw is not supported by the MongoDB driver");
  }

  public override orWhereRaw(): this {
    throw new NotSupportedError("orWhereRaw is not supported by the MongoDB driver");
  }

  public override selectRaw(): this {
    throw new NotSupportedError("selectRaw is not supported by the MongoDB driver");
  }

  public override havingRaw(): this {
    throw new NotSupportedError("havingRaw is not supported by the MongoDB driver");
  }

  public override andHavingRaw(): this {
    throw new NotSupportedError("andHavingRaw is not supported by the MongoDB driver");
  }

  public override orHavingRaw(): this {
    throw new NotSupportedError("orHavingRaw is not supported by the MongoDB driver");
  }

  public override window(): this {
    throw new NotSupportedError("window is not supported by the MongoDB driver");
  }

  // ─── Terminal methods ─────────────────────────────────────────────

  public clone(): IProteusQueryBuilder<E> {
    const cloned = new MongoQueryBuilder<E>(
      this.metadata,
      this.db,
      this.namespace,
      this.logger,
      this.filterRegistry,
      this.session,
      this.amphora,
    );
    cloned.state = this.cloneState();
    cloned.aggregateSelections = [...this.aggregateSelections];
    return cloned;
  }

  public toQuery(): unknown {
    if (this.isAggregationQuery()) {
      return {
        driver: "mongo",
        type: "aggregate",
        collection: this.resolveCollectionName(),
        pipeline: this.buildAggregationPipeline(),
      };
    }

    const filter = this.buildFilter();
    const sort = this.buildSort();
    const projection = this.buildProjection();

    return {
      driver: "mongo",
      type: "find",
      collection: this.resolveCollectionName(),
      filter,
      sort,
      projection,
      skip: this.state.skip,
      limit: this.state.take,
    };
  }

  public async getOne(): Promise<E | null> {
    if (this.isAggregationQuery()) {
      const results = await this.executeAggregation();
      return results.length > 0 ? results[0] : null;
    }

    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const sort = this.buildSort();
    const projection = this.buildProjection();
    const sessionOpts = this.sessionOpts();

    let cursor = collection.find(filter, sessionOpts);
    if (sort) cursor = cursor.sort(sort);
    if (projection) cursor = cursor.project(projection);
    cursor = cursor.limit(1);

    const docs = await cursor.toArray();
    if (docs.length === 0) return null;

    return hydrateEntity<E>(docs[0], this.metadata, this.amphora);
  }

  public async getOneOrFail(): Promise<E> {
    const entity = await this.getOne();
    if (!entity) {
      throw new ProteusRepositoryError(`Entity "${this.metadata.entity.name}" not found`);
    }
    return entity;
  }

  public async getMany(): Promise<Array<E>> {
    if (this.isAggregationQuery()) {
      return this.executeAggregation();
    }

    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const sort = this.buildSort();
    const projection = this.buildProjection();
    const sessionOpts = this.sessionOpts();

    let cursor = collection.find(filter, sessionOpts);
    if (sort) cursor = cursor.sort(sort);
    if (projection) cursor = cursor.project(projection);
    if (this.state.skip != null && this.state.skip > 0)
      cursor = cursor.skip(this.state.skip);
    if (this.state.take != null) cursor = cursor.limit(this.state.take);

    const docs = await cursor.toArray();

    if (this.state.distinct) {
      return this.deduplicateEntities(
        hydrateEntities<E>(docs, this.metadata, this.amphora),
      );
    }

    return hydrateEntities<E>(docs, this.metadata, this.amphora);
  }

  public async getManyAndCount(): Promise<[Array<E>, number]> {
    if (this.isAggregationQuery()) {
      const results = await this.executeAggregation();
      const totalCount = await this.countAggregation();
      return [results, totalCount];
    }

    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const sessionOpts = this.sessionOpts();

    // Count all matching documents (before pagination)
    const totalCount = await collection.countDocuments(filter, sessionOpts);

    // Fetch paginated results
    const sort = this.buildSort();
    const projection = this.buildProjection();
    let cursor = collection.find(filter, sessionOpts);
    if (sort) cursor = cursor.sort(sort);
    if (projection) cursor = cursor.project(projection);
    if (this.state.skip != null && this.state.skip > 0)
      cursor = cursor.skip(this.state.skip);
    if (this.state.take != null) cursor = cursor.limit(this.state.take);

    const docs = await cursor.toArray();
    let entities = hydrateEntities<E>(docs, this.metadata, this.amphora);

    if (this.state.distinct) {
      entities = this.deduplicateEntities(entities);
    }

    return [entities, totalCount];
  }

  public async count(): Promise<number> {
    if (this.isAggregationQuery()) {
      return this.countAggregation();
    }

    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    return collection.countDocuments(filter, this.sessionOpts());
  }

  public async exists(): Promise<boolean> {
    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const count = await collection.countDocuments(filter, {
      limit: 1,
      ...this.sessionOpts(),
    });
    return count > 0;
  }

  public async getRawRows<
    T extends Record<string, unknown> = Record<string, unknown>,
  >(): Promise<Array<T>> {
    if (this.isAggregationQuery()) {
      const collection = this.db.collection(this.resolveCollectionName());
      const pipeline = this.buildAggregationPipeline();
      const sessionOpts = this.sessionOpts();
      const docs = await collection.aggregate(pipeline, sessionOpts).toArray();
      return docs as unknown as Array<T>;
    }

    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const sort = this.buildSort();
    const projection = this.buildProjection();
    const sessionOpts = this.sessionOpts();

    let cursor = collection.find(filter, sessionOpts);
    if (sort) cursor = cursor.sort(sort);
    if (projection) cursor = cursor.project(projection);
    if (this.state.skip != null && this.state.skip > 0)
      cursor = cursor.skip(this.state.skip);
    if (this.state.take != null) cursor = cursor.limit(this.state.take);

    const docs = await cursor.toArray();
    return docs as unknown as Array<T>;
  }

  // ─── Aggregates ───────────────────────────────────────────────────

  public async sum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("$sum", field);
  }

  public async average(field: keyof E): Promise<number | null> {
    return this.computeAggregate("$avg", field);
  }

  public async minimum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("$min", field);
  }

  public async maximum(field: keyof E): Promise<number | null> {
    return this.computeAggregate("$max", field);
  }

  // ─── Write builders ───────────────────────────────────────────────

  public insert(): IInsertQueryBuilder<E> {
    return new MongoInsertQueryBuilder<E>(this.db, this.metadata, this.session);
  }

  public update(): IUpdateQueryBuilder<E> {
    this.guardAppendOnlyWrite("update");
    return new MongoUpdateQueryBuilder<E>(this.db, this.metadata, this.session);
  }

  public delete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("delete");
    return new MongoDeleteQueryBuilder<E>(this.db, this.metadata, false, this.session);
  }

  public softDelete(): IDeleteQueryBuilder<E> {
    this.guardAppendOnlyWrite("softDelete");
    return new MongoDeleteQueryBuilder<E>(this.db, this.metadata, true, this.session);
  }

  // ─── Private ──────────────────────────────────────────────────────

  private resolveCollectionName(): string {
    return resolveBaseCollectionName(this.metadata);
  }

  private sessionOpts(): { session: ClientSession } | undefined {
    return this.session ? { session: this.session } : undefined;
  }

  private isAggregationQuery(): boolean {
    return (
      (this.state.groupBy != null && this.state.groupBy.length > 0) ||
      this.aggregateSelections.length > 0
    );
  }

  /**
   * Build the complete MongoDB filter including system filters
   * (soft-delete, named filters, scope, discriminator).
   */
  private buildFilter(): Filter<Document> {
    const conditions: Array<Document> = [];

    // User predicates
    if (this.state.predicates.length > 0) {
      const userFilter = this.compileUserPredicates();
      if (Object.keys(userFilter).length > 0) {
        conditions.push(userFilter);
      }
    }

    // System filters (soft-delete, scope, named filters)
    const systemConditions = this.buildSystemFilterConditions();
    conditions.push(...systemConditions);

    if (conditions.length === 0) return {};
    if (conditions.length === 1) return conditions[0];
    return { $and: conditions };
  }

  /**
   * Compile user-specified predicates (where/andWhere/orWhere) into a filter.
   */
  private compileUserPredicates(): Document {
    return compilePredicatesToFilter(
      this.state.predicates.map((p) => ({
        ...p,
        predicate: flattenEmbeddedCriteria(p.predicate, this.metadata),
      })),
      this.metadata,
    );
  }

  /**
   * Build system filter conditions (soft-delete, named filters, discriminator).
   */
  private buildSystemFilterConditions(): Array<Document> {
    const conditions: Array<Document> = [];

    // Resolve system + user-defined @Filter predicates via the auto-filter system.
    // This handles __softDelete, __scope, and any user-defined named filters.
    // The soft-delete filter is managed entirely through generateAutoFilters +
    // resolveFilters so that .setFilter("__softDelete", false) correctly disables it.
    const qbOverrides =
      Object.keys(this.state.filterOverrides).length > 0
        ? this.state.filterOverrides
        : undefined;
    const systemOverrides = mergeSystemFilterOverrides(
      qbOverrides,
      this.state.withDeleted,
      this.state.withoutScope,
    );
    const metaFilters = this.metadata.filters?.length
      ? this.metadata.filters
      : generateAutoFilters(this.metadata.fields);
    const resolved = resolveFilters(metaFilters, this.filterRegistry, systemOverrides);

    for (const entry of resolved) {
      const filterCondition = compileFilter(entry.predicate, this.metadata);
      if (Object.keys(filterCondition).length > 0) {
        conditions.push(filterCondition);
      }
    }

    // Discriminator filter for single-table inheritance
    if (this.metadata.inheritance?.discriminatorValue != null) {
      const discField = this.metadata.inheritance.discriminatorField;
      const discValue = this.metadata.inheritance.discriminatorValue;
      const mongoField = resolveMongoFieldName(discField, this.metadata);
      conditions.push({ [mongoField]: discValue });
    }

    return conditions;
  }

  // NOTE: QB uses simple sort without null-safe handling (no NULLS LAST/FIRST).
  // The repository path uses compileNullSafeSort for SQL-standard NULL ordering.
  private buildSort(): Record<string, 1 | -1> | undefined {
    const effectiveOrderBy = this.state.orderBy ?? this.metadata.defaultOrder;
    if (!effectiveOrderBy) return undefined;
    return compileSort(
      effectiveOrderBy as Record<string, "ASC" | "DESC">,
      this.metadata,
    ) as Record<string, 1 | -1> | undefined;
  }

  private buildProjection(): Document | undefined {
    if (!this.state.selections || this.state.selections.length === 0) return undefined;
    return compileProjection(this.state.selections as Array<string>, this.metadata);
  }

  /**
   * Execute an aggregation pipeline for GROUP BY / aggregate queries.
   */
  private async executeAggregation(): Promise<Array<E>> {
    const collection = this.db.collection(this.resolveCollectionName());
    const pipeline = this.buildAggregationPipeline();
    const sessionOpts = this.sessionOpts();
    const docs = await collection.aggregate(pipeline, sessionOpts).toArray();
    return hydrateEntities<E>(docs, this.metadata, this.amphora);
  }

  private buildAggregationPipeline(): Array<Document> {
    // For temporal versionAt queries, build a specialized pipeline
    if (this.state.versionTimestamp && !this.isAggregationQuery()) {
      return this.buildTemporalVersionAtPipeline();
    }

    const filter = this.buildFilter();

    return compileAggregationPipeline<E>({
      filter,
      groupByFields: this.state.groupBy ?? [],
      aggregateSelections: this.aggregateSelections,
      having: this.state.having,
      orderBy: this.state.orderBy,
      skip: this.state.skip,
      take: this.state.take,
      metadata: this.metadata,
    });
  }

  /**
   * Build a pipeline for versionAt() temporal queries.
   * Queries the shadow collection with { __versionedAt: { $lte: timestamp } },
   * then groups by __entityId taking $last of each field (sorted by __versionedAt asc).
   */
  private buildTemporalVersionAtPipeline(): Array<Document> {
    const pipeline: Array<Document> = [];

    // Match conditions (including the temporal filter from buildFilter)
    const filter = this.buildFilter();
    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    // Sort by __versionedAt ascending so $last gives us the latest version
    pipeline.push({ $sort: { __entityId: 1, __versionedAt: 1 } });

    // Group by __entityId, taking the $last snapshot for each field
    const groupStage: Document = {
      _id: "$__entityId",
    };

    // Include all document fields using $last
    for (const field of this.metadata.fields) {
      const mongoField = this.metadata.primaryKeys.includes(field.key)
        ? "__entityId"
        : field.name;
      groupStage[field.name === field.key ? field.key : field.name] = {
        $last: `$${mongoField}`,
      };
    }

    pipeline.push({ $group: groupStage });

    // Apply ordering
    const sort = this.buildSort();
    if (sort) {
      pipeline.push({ $sort: sort });
    }

    // Pagination
    if (this.state.skip != null && this.state.skip > 0) {
      pipeline.push({ $skip: this.state.skip });
    }
    if (this.state.take != null) {
      pipeline.push({ $limit: this.state.take });
    }

    return pipeline;
  }

  /**
   * Count total matching documents for an aggregation query, ignoring $skip/$limit.
   */
  private async countAggregation(): Promise<number> {
    const collection = this.db.collection(this.resolveCollectionName());
    const pipeline = this.buildAggregationPipeline().filter(
      (stage) => !("$skip" in stage) && !("$limit" in stage) && !("$project" in stage),
    );
    pipeline.push({ $count: "total" });
    const sessionOpts = this.sessionOpts();
    const docs = await collection.aggregate(pipeline, sessionOpts).toArray();
    return docs.length > 0 ? docs[0].total : 0;
  }

  /**
   * Compute an aggregate value (sum, avg, min, max) using aggregation pipeline.
   */
  private async computeAggregate(fn: string, field: keyof E): Promise<number | null> {
    const collection = this.db.collection(this.resolveCollectionName());
    const filter = this.buildFilter();
    const mongoField = resolveMongoFieldName(field as string, this.metadata);
    const sessionOpts = this.sessionOpts();

    const pipeline: Array<Document> = [];

    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    pipeline.push({
      $group: {
        _id: null,
        result: { [fn]: `$${mongoField}` },
      },
    });

    const docs = await collection.aggregate(pipeline, sessionOpts).toArray();
    if (docs.length === 0) return null;
    return docs[0].result ?? null;
  }

  /**
   * Deduplicate entities for distinct() queries.
   */
  private deduplicateEntities(entities: Array<E>): Array<E> {
    const seen = new Set<string>();
    return entities.filter((e) => {
      const key = this.state.selections
        ? JSON.stringify(
            Object.fromEntries(
              (this.state.selections as Array<string>).map((k) => [k, (e as any)[k]]),
            ),
          )
        : JSON.stringify(e);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
