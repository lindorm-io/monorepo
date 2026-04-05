import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Predicate } from "@lindorm/types";
import { ProteusRepositoryError } from "../../errors/ProteusRepositoryError";
import type {
  IEntity,
  IProteusCursor,
  IProteusQueryBuilder,
  IProteusRepository,
} from "../../interfaces";
import type {
  ClearOptions,
  CursorOptions,
  DeleteOptions,
  FindOptions,
  FindPaginatedOptions,
  FindPaginatedResult,
  PaginateOptions,
  PaginateResult,
  UpsertOptions,
} from "../../types";
import { EntityManager } from "#internal/entity/classes/EntityManager";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import type { IRepositoryExecutor } from "../interfaces/RepositoryExecutor";
import type { EntityMetadata, QueryScope } from "#internal/entity/types/metadata";
import type { RepositoryFactory } from "#internal/types/repository-factory";
import type { AggregateFunction } from "#internal/types/aggregate";
import type { LazyRelationLoader } from "#internal/entity/utils/install-lazy-relations";
import type { SubscriberRegistryGetter } from "../interfaces/ProteusDriver";
import type { IEntitySubscriber } from "../../interfaces/EntitySubscriber";
import type { SubscriberEventName } from "../utils/subscriber/dispatch-subscribers";
import { buildPrimaryKeyPredicate } from "#internal/utils/repository/build-pk-predicate";
import {
  guardAppendOnly,
  guardDeleteDateField,
  guardExpiryDateField,
  guardUpsertBlocked,
} from "#internal/utils/repository/repository-guards";
import { installLazyRelations } from "#internal/entity/utils/install-lazy-relations";
import { isLazyRelation } from "#internal/entity/utils/lazy-relation";
import { isLazyCollection } from "#internal/entity/utils/lazy-collection";
import { filterHiddenSelections } from "#internal/utils/query/filter-hidden-selections";
import { dispatchSubscribers } from "../utils/subscriber/dispatch-subscribers";
import { validatePaginateOptions } from "#internal/utils/pagination/validate-paginate-options";
import {
  buildKeysetOrder,
  keysetOrderToRecord,
  type KeysetOrderEntry,
} from "#internal/utils/pagination/build-keyset-order";
import { buildKeysetPredicate } from "#internal/utils/pagination/build-keyset-predicate";
import { encodeCursor } from "#internal/utils/pagination/encode-cursor";
import { decodeCursor } from "#internal/utils/pagination/decode-cursor";
import { extractCursorValues } from "#internal/utils/pagination/extract-cursor-values";

export type DriverRepositoryBaseOptions<E extends IEntity> = {
  target: Constructor<E>;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  namespace: string | null;
  logger: ILogger;
  driver: string;
  driverLabel: string;
  context?: unknown;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  getSubscribers?: SubscriberRegistryGetter;
};

export abstract class DriverRepositoryBase<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> implements IProteusRepository<E, O> {
  protected readonly entityManager: EntityManager<E>;
  protected readonly executor: IRepositoryExecutor<E>;
  protected readonly queryBuilderFactory: () => IProteusQueryBuilder<E>;
  protected readonly metadata: EntityMetadata;
  protected readonly namespace: string | null;
  protected readonly logger: ILogger;
  protected readonly parent: Constructor<IEntity> | undefined;
  protected readonly repositoryFactory: RepositoryFactory;
  protected readonly hasRelations: boolean;
  protected readonly hasAsyncRelationIds: boolean;
  protected readonly hasRelationCounts: boolean;
  private readonly getSubscribers: SubscriberRegistryGetter;

  protected constructor(options: DriverRepositoryBaseOptions<E>) {
    this.executor = options.executor;
    this.queryBuilderFactory = options.queryBuilderFactory;
    this.namespace = options.namespace;
    this.logger = options.logger.child([options.driverLabel, options.target.name]);
    this.parent = options.parent;
    this.repositoryFactory = options.repositoryFactory;
    this.getSubscribers =
      options.getSubscribers ?? ((): ReadonlyArray<IEntitySubscriber> => []);
    this.metadata = getEntityMetadata(options.target);
    this.hasRelations = this.metadata.relations.length > 0;
    this.hasAsyncRelationIds = (this.metadata.relationIds ?? []).some((ri) => {
      const rel = this.metadata.relations.find((r) => r.key === ri.relationKey);
      return rel && (!rel.joinKeys || rel.type === "ManyToMany");
    });
    this.hasRelationCounts = (this.metadata.relationCounts ?? []).length > 0;

    this.entityManager = new EntityManager<E>({
      target: options.target,
      driver: options.driver,
      logger: options.logger,
      context: options.context,
    });
  }

  // ─── Abstract methods ────────────────────────────────────────────────

  protected abstract insertOne(input: O | E, hookKind: "insert" | "save"): Promise<E>;
  protected abstract insertBulk(inputs: Array<O | E>): Promise<Array<E>>;
  protected abstract updateOne(entity: E, hookKind: "update" | "save"): Promise<E>;
  protected abstract cloneOne(entity: E): Promise<E>;
  protected abstract destroyOne(entity: E): Promise<void>;
  protected abstract softDestroyOne(entity: E): Promise<void>;
  protected abstract upsertOne(entity: E, options?: UpsertOptions<E>): Promise<E>;
  public abstract find(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
    _scope?: QueryScope,
  ): Promise<Array<E>>;
  public abstract versions(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>>;
  public abstract cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>>;
  public abstract clear(options?: ClearOptions): Promise<void>;
  protected abstract buildLazyLoader(): LazyRelationLoader;
  protected abstract executeAggregate(
    type: AggregateFunction,
    field: keyof E,
    criteria?: Predicate<E>,
  ): Promise<number | null>;
  protected abstract isDuplicateKeyError(error: unknown): boolean;

  // ─── Entity Handlers ──────────────────────────────────────────────

  public create(options?: O | E): E {
    return this.entityManager.create(options);
  }

  public copy(entity: E): E {
    return this.entityManager.copy(entity);
  }

  public validate(entity: E): void {
    this.entityManager.validate(entity);
  }

  // ─── Queries ──────────────────────────────────────────────────────

  public async count(criteria?: Predicate<E>, options?: FindOptions<E>): Promise<number> {
    return this.executor.executeCount(criteria ?? ({} as Predicate<E>), options ?? {});
  }

  public async exists(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<boolean> {
    if (options && Object.keys(options).length > 0) {
      return (await this.executor.executeCount(criteria, options)) > 0;
    }
    return this.executor.executeExists(criteria);
  }

  public async findOne(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E | null> {
    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      ["single"],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const results = await this.find(
      criteria,
      { ...effectiveOptions, limit: 1 },
      "single",
    );
    return results[0] ?? null;
  }

  public async findOneOrFail(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<E> {
    const entity = await this.findOne(criteria, options);
    if (!entity) {
      throw new ProteusRepositoryError(
        `Entity "${this.metadata.entity.name}" not found`,
        { debug: { criteria } },
      );
    }
    return entity;
  }

  public async findAndCount(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<[Array<E>, number]> {
    const countOptions: FindOptions<E> | undefined = options
      ? ((({ limit, offset, ...rest }): Record<string, unknown> => rest)(
          options as any,
        ) as FindOptions<E>)
      : undefined;

    const [entities, count] = await Promise.all([
      this.find(criteria, options),
      this.count(criteria, countOptions),
    ]);
    return [entities, count];
  }

  public async findOneOrSave(
    criteria: Predicate<E>,
    entity: O | E,
    options?: FindOptions<E>,
  ): Promise<E> {
    const existing = await this.findOne(criteria, options);
    if (existing) return existing;
    if (this.metadata.appendOnly) {
      return this.insert(entity);
    }
    return this.save(entity);
  }

  public async findPaginated(
    criteria?: Predicate<E>,
    options?: FindPaginatedOptions<E>,
  ): Promise<FindPaginatedResult<E>> {
    const page = options?.page ?? 1;
    const pageSize = options?.pageSize ?? 10;

    if (page < 1) {
      throw new ProteusRepositoryError("findPaginated: page must be >= 1");
    }
    if (pageSize < 1) {
      throw new ProteusRepositoryError("findPaginated: pageSize must be >= 1");
    }

    const offset = (page - 1) * pageSize;
    const { page: _p, pageSize: _ps, ...rest } = options ?? {};

    const [data, total] = await this.findAndCount(criteria, {
      ...rest,
      limit: pageSize,
      offset,
    });

    const totalPages = Math.ceil(total / pageSize);
    const hasMore = page * pageSize < total;

    return { data, total, page, pageSize, totalPages, hasMore };
  }

  // ─── Pagination ───────────────────────────────────────────────────

  /**
   * Keyset cursor pagination. Returns a page of entities with opaque cursors
   * for efficient, index-friendly seek-based traversal.
   *
   * Cursors are opaque but NOT integrity-protected. Multi-tenant deployments
   * must enforce scope independently via @ScopeField auto-filter.
   */
  public async paginate(
    criteria?: Predicate<E>,
    options?: PaginateOptions<E>,
  ): Promise<PaginateResult<E>> {
    if (!options) {
      throw new ProteusRepositoryError(
        "paginate() requires options with at least `orderBy` and one of `first`/`last`",
        { debug: { entityName: this.metadata.entity.name } },
      );
    }

    validatePaginateOptions(options, this.metadata);

    const isBackward = options.last != null;
    const pageSize = (isBackward ? options.last : options.first)!;
    const cursorToken = isBackward ? options.before : options.after;

    // Build keyset order with PK tiebreaker (F6)
    const keysetEntries = buildKeysetOrder(options.orderBy, this.metadata);
    const columns = keysetEntries.map((e) => e.column);
    const directions = keysetEntries.map((e) => e.direction);

    // Decode cursor if provided, validating columns/directions match
    let cursorValues: Array<unknown> | null = null;
    if (cursorToken) {
      const decoded = decodeCursor(cursorToken, columns, directions);
      cursorValues = decoded.values;
    }

    // For backward pagination, flip all directions
    const effectiveOrderBy = keysetOrderToRecord<E>(keysetEntries, isBackward);

    // Fetch N+1 to determine if there are more pages
    const rows = await this.executePaginateFind(
      criteria ?? ({} as Predicate<E>),
      keysetEntries,
      cursorValues,
      isBackward,
      effectiveOrderBy,
      pageSize + 1,
      options,
    );

    // Determine boundary flags
    const hasMore = rows.length > pageSize;
    if (hasMore) {
      rows.pop(); // Remove the N+1 probe row
    }

    // For backward pagination, reverse the result to restore original order
    if (isBackward) {
      rows.reverse();
    }

    // Build result
    const data = rows;
    const startCursor =
      data.length > 0
        ? encodeCursor(columns, directions, extractCursorValues(data[0], keysetEntries))
        : null;
    const endCursor =
      data.length > 0
        ? encodeCursor(
            columns,
            directions,
            extractCursorValues(data[data.length - 1], keysetEntries),
          )
        : null;

    return {
      data,
      startCursor,
      endCursor,
      hasNextPage: isBackward ? cursorToken != null : hasMore,
      hasPreviousPage: isBackward ? hasMore : cursorToken != null,
    };
  }

  /**
   * Execute the paginate data fetch. Composes user criteria with keyset
   * predicate (via $gt/$lt) and delegates to find().
   *
   * The default implementation uses Predicate operators which work for SQL
   * drivers. The Memory driver overrides this to use in-memory comparison
   * since Predicated.match does not support $gt/$lt on string/Date types.
   */
  protected async executePaginateFind(
    criteria: Predicate<E>,
    keysetEntries: Array<KeysetOrderEntry>,
    cursorValues: Array<unknown> | null,
    isBackward: boolean,
    effectiveOrderBy: Partial<Record<keyof E, "ASC" | "DESC">>,
    limit: number,
    options: PaginateOptions<E>,
  ): Promise<Array<E>> {
    let compositeCriteria: Predicate<E> = criteria;

    if (cursorValues) {
      const keysetPredicate = buildKeysetPredicate<E>(
        keysetEntries,
        cursorValues,
        isBackward,
      );
      if (Object.keys(criteria).length > 0) {
        compositeCriteria = { $and: [criteria, keysetPredicate] } as Predicate<E>;
      } else {
        compositeCriteria = keysetPredicate;
      }
    }

    return this.find(
      compositeCriteria,
      {
        order: effectiveOrderBy,
        limit,
        withDeleted: options.withDeleted,
        withoutScope: options.withoutScope,
        relations: options.relations,
        filters: options.filters,
      },
      "multiple",
    );
  }

  // ─── Create/Update/Destroy ────────────────────────────────────────

  /**
   * Insert one or many entities. The array overload uses insertBulk which bypasses
   * per-entity lifecycle hooks, subscribers, and relation cascades for throughput.
   * Use `save(entities)` if lifecycle and cascade behavior is required.
   */
  public insert(entity: O | E): Promise<E>;
  public insert(entities: Array<O | E>): Promise<Array<E>>;
  public async insert(input: O | E | Array<O | E>): Promise<E | Array<E>> {
    if (Array.isArray(input)) {
      return this.insertBulk(input);
    }
    return this.insertOne(input, "insert");
  }

  public save(entity: O | E): Promise<E>;
  public save(entities: Array<O | E>): Promise<Array<E>>;
  public async save(input: O | E | Array<O | E>): Promise<E | Array<E>> {
    if (this.metadata.appendOnly) {
      throw new ProteusRepositoryError(
        `Cannot save an append-only entity "${this.metadata.entity.name}" — use insert() instead`,
        { debug: { entityName: this.metadata.entity.name, method: "save" } },
      );
    }

    if (Array.isArray(input)) {
      const results: Array<E> = [];
      for (const item of input) {
        results.push(await this.saveOne(item));
      }
      return results;
    }
    return this.saveOne(input);
  }

  public update(entity: E): Promise<E>;
  public update(entities: Array<E>): Promise<Array<E>>;
  public async update(input: E | Array<E>): Promise<E | Array<E>> {
    guardAppendOnly(this.metadata, "update");

    if (Array.isArray(input)) {
      const results: Array<E> = [];
      for (const item of input) {
        results.push(await this.updateOne(item, "update"));
      }
      return results;
    }
    return this.updateOne(input, "update");
  }

  public clone(entity: E): Promise<E>;
  public clone(entities: Array<E>): Promise<Array<E>>;
  public async clone(input: E | Array<E>): Promise<E | Array<E>> {
    if (Array.isArray(input)) {
      const results: Array<E> = [];
      for (const item of input) {
        results.push(await this.cloneOne(item));
      }
      return results;
    }
    return this.cloneOne(input);
  }

  public destroy(entity: E): Promise<void>;
  public destroy(entities: Array<E>): Promise<void>;
  public async destroy(input: E | Array<E>): Promise<void> {
    guardAppendOnly(this.metadata, "destroy");

    if (Array.isArray(input)) {
      for (const item of input) {
        await this.destroyOne(item);
      }
      return;
    }
    await this.destroyOne(input);
  }

  // ─── Increments / Decrements ──────────────────────────────────────

  public async increment(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    guardAppendOnly(this.metadata, "increment");
    await this.executor.executeIncrement(criteria, property, value);
  }

  public async decrement(
    criteria: Predicate<E>,
    property: keyof E,
    value: number,
  ): Promise<void> {
    guardAppendOnly(this.metadata, "decrement");
    await this.executor.executeDecrement(criteria, property, value);
  }

  // ─── With Criteria ────────────────────────────────────────────────

  public async delete(criteria: Predicate<E>, options?: DeleteOptions): Promise<void> {
    guardAppendOnly(this.metadata, "delete");

    await this.executor.executeDelete(criteria, options);
  }

  public async updateMany(criteria: Predicate<E>, update: DeepPartial<E>): Promise<void> {
    guardAppendOnly(this.metadata, "updateMany");

    if (this.entityManager.updateStrategy === "version") {
      throw new ProteusRepositoryError(
        `updateMany is not supported for versioned entity "${this.metadata.entity.name}". Use update() for individual version updates.`,
        { debug: { entityName: this.metadata.entity.name } },
      );
    }

    this.entityManager.verifyReadonly(update);
    await this.executor.executeUpdateMany(criteria, update);
  }

  // ─── Soft Deletes ─────────────────────────────────────────────────

  public softDestroy(entity: E): Promise<void>;
  public softDestroy(entities: Array<E>): Promise<void>;
  public async softDestroy(input: E | Array<E>): Promise<void> {
    guardAppendOnly(this.metadata, "softDestroy");
    guardDeleteDateField(this.metadata, "softDestroy");

    if (Array.isArray(input)) {
      for (const item of input) {
        await this.softDestroyOne(item);
      }
      return;
    }

    await this.softDestroyOne(input);
  }

  /**
   * Soft-delete all entities matching the criteria (criteria-based).
   *
   * Note: This is a criteria-based bulk operation. It does NOT load individual entities
   * and therefore does NOT fire per-entity lifecycle hooks (@BeforeSoftDestroy, etc.)
   * or subscriber events. Use softDestroy() for per-entity lifecycle support.
   */
  public async softDelete(
    criteria: Predicate<E>,
    _options?: DeleteOptions,
  ): Promise<void> {
    guardAppendOnly(this.metadata, "softDelete");
    guardDeleteDateField(this.metadata, "softDelete");
    await this.executor.executeSoftDelete(criteria);
  }

  /**
   * Restore soft-deleted entities matching the criteria by clearing their delete date.
   *
   * Note: This is a criteria-based bulk operation. It does NOT load individual entities
   * and therefore does NOT fire per-entity lifecycle hooks (@BeforeRestore, etc.)
   * or subscriber events. Use individual entity restore workflows for per-entity lifecycle support.
   */
  public async restore(criteria: Predicate<E>, _options?: DeleteOptions): Promise<void> {
    guardAppendOnly(this.metadata, "restore");
    guardDeleteDateField(this.metadata, "restore");
    await this.executor.executeRestore(criteria);
  }

  // ─── TTL / Expiry ─────────────────────────────────────────────────

  public async ttl(criteria: Predicate<E>, _options?: FindOptions<E>): Promise<number> {
    guardExpiryDateField(this.metadata, "ttl");

    const seconds = await this.executor.executeTtl(criteria);

    if (seconds == null) {
      throw new ProteusRepositoryError(
        `Entity "${this.metadata.entity.name}" not found or has no TTL set`,
        { debug: { criteria } },
      );
    }

    return seconds;
  }

  public async deleteExpired(): Promise<void> {
    guardAppendOnly(this.metadata, "deleteExpired");
    guardExpiryDateField(this.metadata, "deleteExpired");
    await this.executor.executeDeleteExpired();
  }

  // ─── Upsert ───────────────────────────────────────────────────────

  public upsert(entity: E, options?: UpsertOptions<E>): Promise<E>;
  public upsert(entities: Array<E>, options?: UpsertOptions<E>): Promise<Array<E>>;
  public async upsert(
    input: E | Array<E>,
    options?: UpsertOptions<E>,
  ): Promise<E | Array<E>> {
    guardAppendOnly(this.metadata, "upsert");
    guardUpsertBlocked(this.metadata);

    if (Array.isArray(input)) {
      const results: Array<E> = [];
      for (const entity of input) {
        results.push(await this.upsertOne(entity, options));
      }
      return results;
    }

    return this.upsertOne(input, options);
  }

  // ─── Aggregates ───────────────────────────────────────────────────

  public async sum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.executeAggregate("sum", field, criteria);
  }

  public async average(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.executeAggregate("avg", field, criteria);
  }

  public async minimum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.executeAggregate("min", field, criteria);
  }

  public async maximum(field: keyof E, criteria?: Predicate<E>): Promise<number | null> {
    return this.executeAggregate("max", field, criteria);
  }

  // ─── Stream ───────────────────────────────────────────────────────

  public stream(options?: CursorOptions<E>): AsyncIterable<E> {
    const createCursor = (): Promise<IProteusCursor<E>> => this.cursor(options);
    return {
      [Symbol.asyncIterator]: (): AsyncIterator<E> => {
        let cursor: IProteusCursor<E> | null = null;
        let iterator: AsyncIterableIterator<E> | null = null;

        const cleanup = async (): Promise<void> => {
          const c = cursor;
          cursor = null;
          iterator = null;
          if (c) await c.close();
        };

        return {
          async next(): Promise<IteratorResult<E>> {
            if (!cursor) {
              cursor = await createCursor();
              iterator = cursor[Symbol.asyncIterator]();
            }
            return iterator!.next();
          },
          async return(): Promise<IteratorResult<E>> {
            if (iterator?.return) {
              await iterator.return(undefined);
            }
            await cleanup();
            return { done: true, value: undefined };
          },
          async throw(err: unknown): Promise<IteratorResult<E>> {
            await cleanup();
            throw err;
          },
        };
      },
    };
  }

  // ─── Global ───────────────────────────────────────────────────────

  public queryBuilder(): IProteusQueryBuilder<E> {
    return this.queryBuilderFactory();
  }

  public async setup(): Promise<void> {
    // No-op — ProteusSource.setup() handles it
  }

  // ─── Protected: Hook dispatch ─────────────────────────────────────

  protected async fireBeforeHook(
    kind: "insert" | "update" | "save",
    entity: E,
  ): Promise<void> {
    if (kind === "insert") await this.entityManager.beforeInsert(entity);
    else if (kind === "update") await this.entityManager.beforeUpdate(entity);
    else await this.entityManager.beforeSave(entity);
  }

  protected async fireAfterHook(
    kind: "insert" | "update" | "save",
    entity: E,
  ): Promise<void> {
    if (kind === "insert") await this.entityManager.afterInsert(entity);
    else if (kind === "update") await this.entityManager.afterUpdate(entity);
    else await this.entityManager.afterSave(entity);
  }

  // ─── Protected: Subscriber dispatch ─────────────────────────────

  /**
   * Dispatch a subscriber lifecycle event. Subscribers fire AFTER entity-level hooks.
   * Errors propagate to the caller (no swallowing) to enable transaction rollback.
   */
  protected async fireSubscriber(
    eventName: SubscriberEventName,
    event: unknown,
  ): Promise<void> {
    const subscribers = this.getSubscribers();
    if (subscribers.length === 0) return;
    await dispatchSubscribers(eventName, event, this.entityManager.target, subscribers);
  }

  /**
   * Build a subscriber event payload with standard fields.
   */
  protected buildSubscriberEvent(
    entity: E,
    connection?: unknown,
  ): { entity: E; metadata: EntityMetadata; connection: unknown } {
    return { entity, metadata: this.metadata, connection: connection ?? null };
  }

  // ─── Protected: Helpers ───────────────────────────────────────────

  protected transferRelations(source: E, target: E): void {
    for (const relation of this.metadata.relations) {
      const val = (source as any)[relation.key];
      if (isLazyRelation(val) || isLazyCollection(val)) continue;
      (target as any)[relation.key] = Array.isArray(val) ? [...val] : val;
    }
  }

  protected applyLazyRelations(entity: E, operationScope: QueryScope): void {
    if (!this.hasRelations) return;
    installLazyRelations(
      entity,
      this.metadata,
      {
        loadRelation: this.buildLazyLoader(),
      },
      operationScope,
    );
  }

  protected async saveOne(input: O | E): Promise<E> {
    const entity =
      input instanceof this.entityManager.target
        ? input
        : this.entityManager.create(input);

    const strategy = this.entityManager.getSaveStrategy(entity);

    switch (strategy) {
      case "insert":
        return this.insertOne(entity, "save");

      case "update":
        return this.updateOne(entity, "save");

      case "unknown": {
        const pk = buildPrimaryKeyPredicate(entity, this.metadata);
        const entityExists = await this.exists(pk, { withDeleted: true });

        if (entityExists) {
          return this.updateOne(entity, "save");
        }

        try {
          return await this.insertOne(entity, "save");
        } catch (error) {
          if (this.isDuplicateKeyError(error)) {
            // Race condition: another process inserted between our exists() check and
            // insertOne(). Fall back to update. Note: BeforeSave hooks already fired once
            // inside insertOne (on a copy that was discarded when the insert failed).
            // They will fire again inside updateOne on a fresh copy. This means
            // side-effectful BeforeSave/AfterSave hooks may execute twice on this path.
            // The entity object itself is unaffected — drivers operate on copies.
            return this.updateOne(entity, "save");
          }
          throw error;
        }
      }
    }
  }
}
