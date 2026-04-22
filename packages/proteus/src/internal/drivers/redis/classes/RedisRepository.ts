import type { Redis } from "ioredis";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Predicate } from "@lindorm/types";
import type {
  IEntity,
  IProteusCursor,
  IProteusQueryBuilder,
} from "../../../../interfaces/index.js";
import type {
  ClearOptions,
  CursorOptions,
  FindOptions,
  UpsertOptions,
} from "../../../../types/index.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { MetaRelation, QueryScope } from "../../../entity/types/metadata.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { AggregateFunction } from "../../../types/aggregate.js";
import type { LazyRelationLoader } from "../../../entity/utils/install-lazy-relations.js";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { ProteusHookMeta } from "../../../../types/proteus-hook-meta.js";
import type { PaginateOptions } from "../../../../types/paginate-options.js";
import type { KeysetOrderEntry } from "../../../utils/pagination/build-keyset-order.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { DriverRepositoryBase } from "../../../classes/DriverRepositoryBase.js";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate.js";
import {
  guardAppendOnly,
  validateRelationNames,
} from "../../../utils/repository/repository-guards.js";
import { RelationPersister } from "../../../utils/repository/RelationPersister.js";
import { buildRelationFilter } from "../../../utils/repository/build-relation-filter.js";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections.js";
import {
  computeAggregateFromValues,
  extractNumericValues,
} from "../../../utils/query/compute-in-memory-aggregate.js";
import { executePaginateFindInMemory } from "../../../utils/pagination/execute-paginate-find-in-memory.js";
import { getSnapshot, clearSnapshot } from "../../../entity/utils/snapshot-store.js";
import { diffColumns } from "../../../entity/utils/diff-columns.js";
import { NotSupportedError } from "../../../../errors/NotSupportedError.js";
import { RedisDriverError } from "../errors/RedisDriverError.js";
import { RedisDuplicateKeyError } from "../errors/RedisDuplicateKeyError.js";
import { RedisCursor } from "./RedisCursor.js";
import {
  createRedisJoinTableOps,
  buildForwardJoinScanPattern,
  buildReverseJoinScanPattern,
} from "../utils/redis-join-table-ops.js";
import { buildJoinSetKey, buildReverseJoinSetKey } from "../utils/build-join-set-key.js";
import { buildScanPattern } from "../utils/build-scan-pattern.js";
import { scanEntityKeys } from "../utils/scan-entity-keys.js";
import { deserializeHash } from "../utils/deserialize-hash.js";
import { resolveInheritanceRoot } from "../../../entity/utils/resolve-inheritance-root.js";

export type RedisRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  client: Redis;
  namespace: string | null;
  logger: ILogger;
  meta?: ProteusHookMeta;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  emitEntity?: EntityEmitFn;
};

export class RedisRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> extends DriverRepositoryBase<E, O> {
  private readonly client: Redis;
  private readonly hasEagerRelations: boolean;

  public constructor(options: RedisRepositoryOptions<E>) {
    super({
      target: options.target,
      executor: options.executor,
      queryBuilderFactory: options.queryBuilderFactory,
      namespace: options.namespace,
      logger: options.logger,
      driver: "redis",
      driverLabel: "RedisRepository",
      meta: options.meta,
      parent: options.parent,
      repositoryFactory: options.repositoryFactory,
      emitEntity: options.emitEntity,
    });

    this.client = options.client;
    this.hasEagerRelations = this.metadata.relations.some(
      (r) =>
        r.options.loading.single === "eager" || r.options.loading.multiple === "eager",
    );
  }

  // ─── Abstract: find / versions ────────────────────────────────────

  public async find(
    criteria?: Predicate<E>,
    options?: FindOptions<E>,
    _scope: QueryScope = "multiple",
  ): Promise<Array<E>> {
    if (options?.relations) {
      validateRelationNames(this.metadata, options.relations as Array<string>);
    }

    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      ["multiple"],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const entities = await this.executor.executeFind(
      criteria ?? ({} as Predicate<E>),
      effectiveOptions ?? {},
    );

    if (this.hasAsyncRelationIds || this.hasRelationCounts) {
      await this.loadRelationIdsAndCounts(entities);
    }

    for (const entity of entities) {
      if (this.hasEagerRelations || options?.relations) {
        await this.loadEagerRelations(
          entity,
          _scope,
          options?.relations as Array<string>,
        );
      }
      this.applyLazyRelations(entity, _scope);
      await this.entityManager.afterLoad(entity);
      await this.fireSubscriber("afterLoad", this.buildSubscriberEvent(entity));
    }

    return entities;
  }

  public async versions(
    _criteria: Predicate<E>,
    _options?: FindOptions<E>,
  ): Promise<Array<E>> {
    throw new NotSupportedError(
      "Redis driver does not support versioned entities. Use a SQL or Memory driver for version history.",
    );
  }

  // ─── Override: executePaginateFind ──────────────────────────────────

  /**
   * The Redis driver uses in-memory keyset filtering like the Memory driver
   * because the executor does client-side filtering with Predicated.match,
   * which does not support comparison operators on string types.
   *
   * NOTE: O(N) memory per page — when a cursor is provided, all matching rows
   * are loaded into memory before applying the keyset filter and limit. This
   * matches the Memory driver behavior and is an accepted limitation of
   * client-side filtering drivers.
   */
  protected override async executePaginateFind(
    criteria: Predicate<E>,
    keysetEntries: Array<KeysetOrderEntry>,
    cursorValues: Array<unknown> | null,
    isBackward: boolean,
    effectiveOrderBy: Partial<Record<keyof E, "ASC" | "DESC">>,
    limit: number,
    options: PaginateOptions<E>,
  ): Promise<Array<E>> {
    return executePaginateFindInMemory(
      this.find.bind(this),
      criteria,
      keysetEntries,
      cursorValues,
      isBackward,
      effectiveOrderBy,
      limit,
      options,
    );
  }

  // ─── Abstract: cursor / clear ─────────────────────────────────────

  /**
   * Returns a cursor for streaming raw entity access.
   *
   * NOTE: Cursor bypasses the entity lifecycle — returned entities do NOT have:
   * - Eager relations loaded
   * - Lazy relation proxies applied
   * - afterLoad subscriber events fired
   *
   * Use find() for full lifecycle processing.
   */
  public async cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>> {
    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      ["multiple"],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const findOptions: FindOptions<E> = {
      select: effectiveOptions?.select,
      order: effectiveOptions?.orderBy,
      withDeleted: effectiveOptions?.withDeleted,
      versionTimestamp: effectiveOptions?.versionTimestamp ?? undefined,
    };

    if (effectiveOptions?.where) {
      const entities = await this.executor.executeFind(
        effectiveOptions.where,
        findOptions,
      );
      return new RedisCursor<E>(entities);
    }

    const entities = await this.executor.executeFind({} as Predicate<E>, findOptions);
    return new RedisCursor<E>(entities);
  }

  public async clear(_options?: ClearOptions): Promise<void> {
    guardAppendOnly(this.metadata, "clear");

    // NOTE: Auto-increment counter keys ({ns:}seq:*) are NOT deleted by clear() —
    // counters persist across clear() calls for monotonic correctness.

    // For single-table inheritance children, scan under the ROOT entity pattern
    // and delete only hashes whose discriminator field matches this child's value.
    const isSingleTableChild =
      this.metadata.inheritance?.strategy === "single-table" &&
      this.metadata.inheritance.discriminatorValue != null;

    if (isSingleTableChild) {
      const rootTarget = resolveInheritanceRoot(this.metadata.target, this.metadata);
      const rootPattern = buildScanPattern(rootTarget, this.namespace);
      const allKeys = await scanEntityKeys(this.client, rootPattern);

      if (allKeys.length === 0) return;

      const discField = this.metadata.fields.find(
        (f) => f.key === this.metadata.inheritance!.discriminatorField,
      );
      const discValue = this.metadata.inheritance!.discriminatorValue;

      const fetchPipeline = this.client.pipeline();
      for (const key of allKeys) {
        fetchPipeline.hgetall(key);
      }
      const fetchResults = await fetchPipeline.exec();
      if (!fetchResults) {
        throw new RedisDriverError("Pipeline execution returned null during clear()");
      }

      const keysToDelete: string[] = [];
      for (let i = 0; i < fetchResults.length; i++) {
        const [err, hash] = fetchResults[i];
        if (err || !hash) continue;
        const row = deserializeHash(
          hash as Record<string, string>,
          this.metadata.fields,
          this.metadata.relations,
        );
        if (row && discField && row[discField.key] === discValue) {
          keysToDelete.push(allKeys[i]);
        }
      }

      if (keysToDelete.length === 0) return;

      const delPipeline = this.client.pipeline();
      for (const key of keysToDelete) {
        delPipeline.del(key);
      }
      const delResult = await delPipeline.exec();
      if (!delResult) {
        throw new RedisDriverError("Pipeline execution returned null during clear()");
      }
      return;
    }

    // Delete all entity HASH keys
    const entityPattern = buildScanPattern(this.metadata.target, this.namespace);
    const entityKeys = await scanEntityKeys(this.client, entityPattern);

    // Delete all M2M join SET keys (forward + reverse) for each M2M relation
    const joinKeys: Array<string> = [];
    for (const relation of this.metadata.relations) {
      if (relation.type !== "ManyToMany" || typeof relation.joinTable !== "string")
        continue;

      const forwardPattern = buildForwardJoinScanPattern(
        relation.joinTable,
        this.namespace,
      );
      const forwardKeys = await scanEntityKeys(this.client, forwardPattern);
      joinKeys.push(...forwardKeys);

      const reversePattern = buildReverseJoinScanPattern(
        relation.joinTable,
        this.namespace,
      );
      const reverseKeys = await scanEntityKeys(this.client, reversePattern);
      joinKeys.push(...reverseKeys);
    }

    const allKeys = [...new Set([...entityKeys, ...joinKeys])];
    if (allKeys.length === 0) return;

    const pipeline = this.client.pipeline();
    for (const key of allKeys) {
      pipeline.del(key);
    }
    const result = await pipeline.exec();
    if (!result) {
      throw new RedisDriverError("Pipeline execution returned null during clear()");
    }
  }

  // ─── Abstract: single-entity operations ───────────────────────────

  protected async insertBulk(inputs: Array<O | E>): Promise<Array<E>> {
    const prepared: Array<E> = [];
    for (const input of inputs) {
      const entity =
        input instanceof this.entityManager.target
          ? input
          : this.entityManager.create(input);
      const p = await this.entityManager.insert(entity);
      this.entityManager.validate(p);
      prepared.push(p);
    }

    if (prepared.length === 0) return [];

    const hydrated = await this.executor.executeInsertBulk(prepared);

    for (const entity of hydrated) {
      this.applyLazyRelations(entity, "single");
    }

    return hydrated;
  }

  protected async insertOne(
    input: O | E,
    hookKind: "insert" | "save" = "insert",
  ): Promise<E> {
    const entity =
      input instanceof this.entityManager.target
        ? input
        : this.entityManager.create(input);

    const prepared = await this.entityManager.insert(entity);
    this.entityManager.validate(prepared);

    // Fast path: no relations
    if (!this.hasRelations) {
      await this.fireBeforeHook(hookKind, prepared);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeInsert(prepared);
      await this.fireAfterHook(hookKind, hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
      return hydrated;
    }

    const relPersister = this.buildRelationPersister();
    await relPersister.saveOwning(prepared, "insert");

    await this.fireBeforeHook(hookKind, prepared);
    await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
    const hydrated = await this.executor.executeInsert(prepared);
    await this.fireAfterHook(hookKind, hydrated);
    await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

    this.transferRelations(prepared, hydrated);

    await relPersister.saveInverse(hydrated, "insert");

    this.applyLazyRelations(hydrated, "single");
    return hydrated;
  }

  protected async updateOne(
    entity: E,
    hookKind: "update" | "save" = "update",
  ): Promise<E> {
    if (this.entityManager.updateStrategy === "version") {
      return this.updateVersioned(entity, hookKind);
    }

    return this.updateStandard(entity, hookKind);
  }

  private async updateStandard(
    entity: E,
    hookKind: "update" | "save" = "update",
  ): Promise<E> {
    const snapshot = getSnapshot(entity);

    if (snapshot) {
      const changed = diffColumns(entity, this.metadata, snapshot);

      if (changed === null && !this.hasRelations) {
        return entity;
      }

      if (changed === null) {
        const relPersister = this.buildRelationPersister();
        await relPersister.saveOwning(entity, "update");
        await relPersister.saveInverse(entity, "update");
        return entity;
      }
    }

    const prepared = this.entityManager.update(entity);
    this.entityManager.validate(prepared);
    const oldEntity = snapshot ? entity : undefined;
    const updateEvent = { ...this.buildSubscriberEvent(prepared), oldEntity };

    if (!this.hasRelations) {
      await this.fireBeforeHook(hookKind, prepared);
      await this.fireSubscriber("beforeUpdate", updateEvent);
      const hydrated = await this.executor.executeUpdate(prepared);
      await this.fireAfterHook(hookKind, hydrated);
      await this.fireSubscriber("afterUpdate", {
        ...this.buildSubscriberEvent(hydrated),
        oldEntity,
      });
      return hydrated;
    }

    const relPersister = this.buildRelationPersister();
    await relPersister.saveOwning(prepared, "update");

    await this.fireBeforeHook(hookKind, prepared);
    await this.fireSubscriber("beforeUpdate", {
      ...this.buildSubscriberEvent(prepared),
      oldEntity,
    });
    const hydrated = await this.executor.executeUpdate(prepared);
    await this.fireAfterHook(hookKind, hydrated);
    await this.fireSubscriber("afterUpdate", {
      ...this.buildSubscriberEvent(hydrated),
      oldEntity,
    });

    this.transferRelations(prepared, hydrated);

    await relPersister.saveInverse(hydrated, "update");

    this.applyLazyRelations(hydrated, "single");
    return hydrated;
  }

  private async updateVersioned(
    entity: E,
    hookKind: "update" | "save" = "update",
  ): Promise<E> {
    const snapshot = getSnapshot(entity);
    if (snapshot) {
      const tempCopy = this.entityManager.copy(entity);
      const changed = diffColumns(tempCopy, this.metadata, snapshot);

      if (changed === null && !this.hasRelations) {
        return entity;
      }

      if (changed === null) {
        const relPersister = this.buildRelationPersister();
        await relPersister.saveOwning(entity, "update");
        await relPersister.saveInverse(entity, "update");
        return entity;
      }
    }

    const now = new Date();
    const partial = this.entityManager.versionUpdate(entity);

    const versionEndDateField = this.metadata.fields.find(
      (f) => f.decorator === "VersionEndDate",
    );
    if (versionEndDateField) {
      (partial as any)[versionEndDateField.key] = now;
    }

    const pkPredicate = buildPrimaryKeyPredicate(entity, this.metadata);
    await this.executor.executeUpdateMany(pkPredicate, partial, { systemFilters: false });

    const newVersion = this.entityManager.versionCopy(partial, entity);

    const versionStartDateField = this.metadata.fields.find(
      (f) => f.decorator === "VersionStartDate",
    );
    if (versionStartDateField) {
      (newVersion as any)[versionStartDateField.key] = now;
    }

    this.entityManager.validate(newVersion);

    const relPersister = this.buildRelationPersister();
    await relPersister.saveOwning(newVersion, "update");

    const oldEntity = entity;
    await this.fireBeforeHook(hookKind, newVersion);
    await this.fireSubscriber("beforeUpdate", {
      ...this.buildSubscriberEvent(newVersion),
      oldEntity,
    });
    const hydrated = await this.executor.executeInsert(newVersion);
    await this.fireAfterHook(hookKind, hydrated);
    await this.fireSubscriber("afterUpdate", {
      ...this.buildSubscriberEvent(hydrated),
      oldEntity,
    });

    this.transferRelations(newVersion, hydrated);

    await relPersister.saveInverse(hydrated, "update");

    this.applyLazyRelations(hydrated, "single");
    clearSnapshot(entity);

    return hydrated;
  }

  protected async cloneOne(entity: E): Promise<E> {
    const cloned = await this.entityManager.clone(entity);
    this.entityManager.validate(cloned);

    if (!this.hasRelations) {
      await this.entityManager.beforeInsert(cloned);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(cloned));
      const hydrated = await this.executor.executeInsert(cloned);
      await this.entityManager.afterInsert(hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
      return hydrated;
    }

    const relPersister = this.buildRelationPersister();
    await relPersister.saveOwning(cloned, "insert");

    await this.entityManager.beforeInsert(cloned);
    await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(cloned));
    const hydrated = await this.executor.executeInsert(cloned);
    await this.entityManager.afterInsert(hydrated);
    await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

    this.transferRelations(cloned, hydrated);

    await relPersister.saveInverse(hydrated, "insert");

    this.applyLazyRelations(hydrated, "single");
    return hydrated;
  }

  /**
   * NOTE: If RelationPersister.destroy partially succeeds before throwing, some child
   * relations may be destroyed while the parent entity remains. This is an
   * accepted limitation — Redis has no multi-key transactions.
   */
  protected async destroyOne(entity: E): Promise<void> {
    await this.entityManager.beforeDestroy(entity);
    await this.fireSubscriber("beforeDestroy", this.buildSubscriberEvent(entity));

    if (!this.hasRelations) {
      await this.executor.executeDelete(buildPrimaryKeyPredicate(entity, this.metadata));
      await this.entityManager.afterDestroy(entity);
      await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
      clearSnapshot(entity);
      return;
    }

    const relPersister = this.buildRelationPersister();

    try {
      await relPersister.destroy(entity);
    } catch (err) {
      this.logger.warn(
        "Partial relation destroy during destroyOne — some child relations may have been destroyed",
        { error: err },
      );
      throw err;
    }

    await this.executor.executeDelete(buildPrimaryKeyPredicate(entity, this.metadata));

    await this.entityManager.afterDestroy(entity);
    await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

  /**
   * NOTE: If RelationPersister.destroy partially succeeds before throwing, some child
   * relations may be destroyed while the parent entity remains. This is an
   * accepted limitation — Redis has no multi-key transactions.
   */
  protected async softDestroyOne(entity: E): Promise<void> {
    await this.entityManager.beforeSoftDestroy(entity);
    await this.fireSubscriber("beforeSoftDestroy", this.buildSubscriberEvent(entity));

    if (!this.hasRelations) {
      await this.executor.executeSoftDelete(
        buildPrimaryKeyPredicate(entity, this.metadata),
      );
      await this.entityManager.afterSoftDestroy(entity);
      await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
      clearSnapshot(entity);
      return;
    }

    const relPersister = this.buildRelationPersister();

    try {
      await relPersister.destroy(entity, true);
    } catch (err) {
      this.logger.warn(
        "Partial relation destroy during softDestroyOne — some child relations may have been destroyed",
        { error: err },
      );
      throw err;
    }

    await this.executor.executeSoftDelete(
      buildPrimaryKeyPredicate(entity, this.metadata),
    );

    await this.entityManager.afterSoftDestroy(entity);
    await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

  /**
   * NOTE: Redis limitation — the version fetch (EXISTS -> FIND -> UPDATE) is three
   * non-atomic operations. A concurrent update between FIND and UPDATE could cause
   * an optimistic lock collision. This is an accepted trade-off given Redis's
   * architecture (no multi-key transactions with WATCH in pipeline mode).
   */
  protected async upsertOne(entity: E, _options?: UpsertOptions<E>): Promise<E> {
    // Redis cannot enforce uniqueness on arbitrary columns — conflictOn is unsupported
    if (_options?.conflictOn && _options.conflictOn.length > 0) {
      throw new NotSupportedError(
        "Redis driver does not support upsert with conflictOn. " +
          "Use PK-based upsert or a driver with unique constraint support.",
      );
    }

    const prepared = await this.entityManager.insert(entity);
    this.entityManager.validate(prepared);

    const pk = buildPrimaryKeyPredicate(prepared, this.metadata);
    const entityExists = await this.exists(pk);

    // Fast path: no relations
    if (!this.hasRelations) {
      if (entityExists) {
        const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
        if (versionField) {
          const stored = await this.executor.executeFind(pk, { limit: 1 });
          if (stored.length > 0) {
            const storedVersion = (stored[0] as any)[versionField.key] as number;
            (prepared as any)[versionField.key] = storedVersion + 1;
          }
        }
        await this.fireBeforeHook("update", prepared);
        await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
        const hydrated = await this.executor.executeUpdate(prepared);
        await this.fireAfterHook("update", hydrated);
        await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));
        return hydrated;
      }

      await this.fireBeforeHook("insert", prepared);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeInsert(prepared);
      await this.fireAfterHook("insert", hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
      return hydrated;
    }

    const relPersister = this.buildRelationPersister();

    if (entityExists) {
      const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
      if (versionField) {
        const stored = await this.executor.executeFind(pk, { limit: 1 });
        if (stored.length > 0) {
          const storedVersion = (stored[0] as any)[versionField.key] as number;
          (prepared as any)[versionField.key] = storedVersion + 1;
        }
      }

      await relPersister.saveOwning(prepared, "update");

      await this.fireBeforeHook("update", prepared);
      await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeUpdate(prepared);
      await this.fireAfterHook("update", hydrated);
      await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));

      this.transferRelations(prepared, hydrated);
      await relPersister.saveInverse(hydrated, "update");
      this.applyLazyRelations(hydrated, "single");
      return hydrated;
    }

    await relPersister.saveOwning(prepared, "insert");

    await this.fireBeforeHook("insert", prepared);
    await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
    const hydrated = await this.executor.executeInsert(prepared);
    await this.fireAfterHook("insert", hydrated);
    await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

    this.transferRelations(prepared, hydrated);
    await relPersister.saveInverse(hydrated, "insert");
    this.applyLazyRelations(hydrated, "single");
    return hydrated;
  }

  // ─── Abstract: aggregates ─────────────────────────────────────────

  protected async executeAggregate(
    type: AggregateFunction,
    field: keyof E,
    criteria?: Predicate<E>,
  ): Promise<number | null> {
    const entities = await this.find(criteria);
    if (entities.length === 0) return null;
    return computeAggregateFromValues(
      type,
      extractNumericValues(entities as Array<Record<string, unknown>>, field as string),
    );
  }

  // ─── Abstract: buildLazyLoader / isDuplicateKeyError ──────────────

  protected buildLazyLoader(): LazyRelationLoader {
    const target = this.metadata.target;
    return async (entity: IEntity, relation: MetaRelation) => {
      if (relation.type === "ManyToMany") {
        return this.loadManyToManyLazy(entity, relation);
      }

      const foreignTarget = relation.foreignConstructor();
      const repo = this.repositoryFactory(foreignTarget, target);
      const filter = buildRelationFilter(relation, entity);
      const isCol = relation.type === "OneToMany";
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return isCol ? repo.find(filter, orderOpts) : repo.findOne(filter);
    };
  }

  protected isDuplicateKeyError(error: unknown): boolean {
    return error instanceof RedisDuplicateKeyError;
  }

  // ─── Private: Redis-specific helpers ──────────────────────────────

  private async loadEagerRelations(
    entity: E,
    operationScope: QueryScope,
    explicitRelations?: Array<string>,
  ): Promise<void> {
    const loader = this.buildLazyLoader();

    for (const relation of this.metadata.relations) {
      const shouldLoad =
        relation.options.loading[operationScope] === "eager" ||
        explicitRelations?.includes(relation.key);
      if (!shouldLoad) continue;

      // Skip if parent is the same target to avoid circular loading,
      // unless the relation was explicitly requested via options.relations
      const isExplicitlyRequested = explicitRelations?.includes(relation.key);
      if (this.parent === relation.foreignConstructor() && !isExplicitlyRequested)
        continue;

      const result = await loader(entity, relation);
      (entity as any)[relation.key] = result;
    }
  }

  private async loadManyToManyLazy(
    entity: IEntity,
    relation: MetaRelation,
  ): Promise<Array<IEntity>> {
    const foreignTarget = relation.foreignConstructor();
    const foreignMeta = getEntityMetadata(foreignTarget);

    const inverseRelation = foreignMeta.relations.find(
      (r) =>
        r.type === "ManyToMany" &&
        r.foreignKey === relation.key &&
        r.key === relation.foreignKey &&
        r.joinTable === relation.joinTable,
    );

    if (!relation.findKeys || !inverseRelation?.findKeys) return [];

    const joinTableName = relation.joinTable as string;

    // Use our own findKeys for the WHERE clause and the foreign side's findKeys
    // to identify which target PKs we need to fetch.
    const whereJoinKeys = relation.findKeys;
    const selectJoinKeys = inverseRelation.findKeys;

    const whereEntries = Object.entries(whereJoinKeys);
    const foreignPkKeys = Object.values(selectJoinKeys);

    const [whereCol, whereEntityKey] = whereEntries[0];
    const entityPkValue = (entity as any)[whereEntityKey];

    // Both forward and reverse SETs may exist depending on which side saved.
    // Query both in a single pipeline and union the results to ensure correctness
    // regardless of which side of the M2M relation performed the sync.
    const forwardKey = buildJoinSetKey(
      joinTableName,
      whereCol,
      entityPkValue,
      this.namespace,
    );
    const reverseKey = buildReverseJoinSetKey(
      joinTableName,
      whereCol,
      entityPkValue,
      this.namespace,
    );

    const pipeline = this.client.pipeline();
    pipeline.smembers(forwardKey);
    pipeline.smembers(reverseKey);
    const results = await pipeline.exec();

    const forwardMembers: Array<string> = (results?.[0]?.[1] as Array<string>) ?? [];
    const reverseMembers: Array<string> = (results?.[1]?.[1] as Array<string>) ?? [];
    const targetPkValues = [...new Set([...forwardMembers, ...reverseMembers])];

    if (targetPkValues.length === 0) return [];

    // Convert SET members (always strings from Redis) to the foreign entity's
    // PK type. Integer PKs must be converted from string to number.
    const foreignPkField = foreignMeta.fields.find((f) =>
      foreignMeta.primaryKeys.includes(f.key),
    );
    const isIntegerPk =
      foreignPkField?.type === "integer" ||
      foreignPkField?.type === "smallint" ||
      foreignPkField?.type === "bigint";

    const typedPkValues: Array<unknown> = isIntegerPk
      ? targetPkValues.map(Number)
      : targetPkValues;

    const repo = this.repositoryFactory(foreignTarget, this.metadata.target);

    if (foreignPkKeys.length === 1) {
      const pkKey = foreignPkKeys[0];
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return repo.find({ [pkKey]: { $in: typedPkValues } }, orderOpts);
    }

    // Composite PK fallback — only uses the first PK field
    const entities: Array<IEntity> = [];
    for (const pk of typedPkValues) {
      const filter: Record<string, unknown> = {};
      filter[foreignPkKeys[0]] = pk;
      const found = await repo.findOne(filter);
      if (found) entities.push(found);
    }
    return entities;
  }

  private async loadRelationIdsAndCounts(entities: Array<E>): Promise<void> {
    await Promise.all(
      entities.map(async (entity) => {
        // Load RelationIds for async relations (M2M, inverse *ToOne)
        for (const ri of this.metadata.relationIds ?? []) {
          const relation = this.metadata.relations.find((r) => r.key === ri.relationKey);
          if (!relation) continue;

          // Sync ones are already hydrated by defaultHydrateEntity
          if (relation.joinKeys && relation.type !== "ManyToMany") continue;

          if (relation.type === "ManyToMany") {
            const items = await this.loadManyToManyLazy(entity, relation);
            const foreignTarget = relation.foreignConstructor();
            const foreignMeta = getEntityMetadata(foreignTarget);
            const pkKey = ri.column ?? foreignMeta.primaryKeys[0];
            (entity as any)[ri.key] = items.map((item) => (item as any)[pkKey]);
          } else {
            const foreignTarget = relation.foreignConstructor();
            const filter = buildRelationFilter(relation, entity);
            const repo = this.repositoryFactory(foreignTarget, this.metadata.target);
            const found = await repo.findOne(filter);
            if (found) {
              const foreignMeta = getEntityMetadata(foreignTarget);
              const pkKey = ri.column ?? foreignMeta.primaryKeys[0];
              (entity as any)[ri.key] = (found as any)[pkKey];
            }
          }
        }

        // Load RelationCounts
        for (const rc of this.metadata.relationCounts ?? []) {
          const relation = this.metadata.relations.find((r) => r.key === rc.relationKey);
          if (!relation) continue;

          if (relation.type === "ManyToMany") {
            const items = await this.loadManyToManyLazy(entity, relation);
            (entity as any)[rc.key] = items.length;
          } else if (relation.type === "OneToMany") {
            const foreignTarget = relation.foreignConstructor();
            const filter = buildRelationFilter(relation, entity);
            const repo = this.repositoryFactory(foreignTarget, this.metadata.target);
            (entity as any)[rc.key] = await repo.count(filter);
          }
        }
      }),
    );
  }

  private buildRelationPersister(): RelationPersister {
    return new RelationPersister({
      metadata: this.metadata,
      namespace: this.namespace,
      parent: this.parent,
      repositoryFactory: this.repositoryFactory,
      joinTableOps: createRedisJoinTableOps(this.client, this.namespace),
      logger: this.logger,
    });
  }
}
