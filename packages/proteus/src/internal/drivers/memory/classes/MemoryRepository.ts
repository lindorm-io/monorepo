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
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { MetaRelation, QueryScope } from "../../../entity/types/metadata.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { AggregateFunction } from "../../../types/aggregate.js";
import type { MemoryStore } from "../types/memory-store.js";
import { DriverRepositoryBase } from "../../../classes/DriverRepositoryBase.js";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate.js";
import {
  guardAppendOnly,
  guardVersionFields,
  validateRelationNames,
} from "../../../utils/repository/repository-guards.js";
import { RelationPersister } from "../../../utils/repository/RelationPersister.js";
import { createMemoryJoinTableOps } from "../utils/memory-join-table-ops.js";
import type { LazyRelationLoader } from "../../../entity/utils/install-lazy-relations.js";
import { buildRelationFilter } from "../../../utils/repository/build-relation-filter.js";
import { MemoryDuplicateKeyError } from "../errors/MemoryDuplicateKeyError.js";
import { MemoryCursor } from "./MemoryCursor.js";
import { getSnapshot, clearSnapshot } from "../../../entity/utils/snapshot-store.js";
import { diffColumns } from "../../../entity/utils/diff-columns.js";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections.js";
import {
  computeAggregateFromValues,
  extractNumericValues,
} from "../../../utils/query/compute-in-memory-aggregate.js";
import { getEntityName } from "../../../entity/utils/get-entity-name.js";
import { getJoinName } from "../../../entity/utils/get-join-name.js";
import {
  saveMemoryEmbeddedListRows,
  loadMemoryEmbeddedListRows,
  deleteMemoryEmbeddedListRows,
} from "../utils/memory-embedded-list-ops.js";
import { installLazyEmbeddedLists } from "../../../entity/utils/install-lazy-embedded-lists.js";
import type { MetaEmbeddedList } from "../../../entity/types/metadata.js";
import type { ILogger } from "@lindorm/logger";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { PaginateOptions } from "../../../../types/paginate-options.js";
import type { KeysetOrderEntry } from "../../../utils/pagination/build-keyset-order.js";
import { executePaginateFindInMemory } from "../../../utils/pagination/execute-paginate-find-in-memory.js";

export type WithImplicitTransaction<E extends IEntity> = <T>(
  fn: (ctx: {
    executor: IRepositoryExecutor<E>;
    repositoryFactory: RepositoryFactory;
    store: MemoryStore;
  }) => Promise<T>,
) => Promise<T>;

export type MemoryRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  store: MemoryStore;
  namespace: string | null;
  logger: ILogger;
  context?: unknown;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  withImplicitTransaction: WithImplicitTransaction<E>;
  emitEntity?: EntityEmitFn;
};

export class MemoryRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> extends DriverRepositoryBase<E, O> {
  private readonly store: MemoryStore;
  private readonly withImplicitTransaction: WithImplicitTransaction<E>;
  private readonly hasEagerRelations: boolean;
  private readonly hasEmbeddedLists: boolean;

  public constructor(options: MemoryRepositoryOptions<E>) {
    super({
      target: options.target,
      executor: options.executor,
      queryBuilderFactory: options.queryBuilderFactory,
      namespace: options.namespace,
      logger: options.logger,
      driver: "memory",
      driverLabel: "MemoryRepository",
      context: options.context,
      parent: options.parent,
      repositoryFactory: options.repositoryFactory,
      emitEntity: options.emitEntity,
    });

    this.store = options.store;
    this.withImplicitTransaction = options.withImplicitTransaction;
    this.hasEagerRelations = this.metadata.relations.some(
      (r) =>
        r.options.loading.single === "eager" || r.options.loading.multiple === "eager",
    );
    this.hasEmbeddedLists = (this.metadata.embeddedLists ?? []).length > 0;
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

    if (this.hasEmbeddedLists) {
      this.loadAllEmbeddedLists(entities, this.store, _scope);
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
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    guardVersionFields(this.metadata, "versions");

    const entities = await this.executor.executeFind(criteria, {
      ...options,
      withDeleted: true,
      withAllVersions: true,
    } as FindOptions<E>);

    if (this.hasAsyncRelationIds || this.hasRelationCounts) {
      await this.loadRelationIdsAndCounts(entities);
    }

    if (this.hasEmbeddedLists) {
      this.loadAllEmbeddedLists(entities, this.store, "multiple");
    }

    for (const entity of entities) {
      if (this.hasEagerRelations || options?.relations) {
        await this.loadEagerRelations(
          entity,
          "multiple",
          options?.relations as Array<string>,
        );
      }
      this.applyLazyRelations(entity, "multiple");
      await this.entityManager.afterLoad(entity);
      await this.fireSubscriber("afterLoad", this.buildSubscriberEvent(entity));
    }

    return entities;
  }

  // ─── Override: executePaginateFind ──────────────────────────────────
  //
  // The Memory driver cannot use Predicate-based keyset WHERE ($gt/$lt on strings)
  // because Predicated.match does not support comparison operators on string types.
  // Instead, we fetch all matching rows with ordering, then filter in-memory using
  // a comparison function that handles all comparable types.

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
      if (this.hasEmbeddedLists) {
        this.loadAllEmbeddedLists(entities, this.store, "multiple");
      }
      this.installLazyEmbeddedListsForCursor(entities);
      return new MemoryCursor<E>(entities);
    }

    const entities = await this.executor.executeFind({} as Predicate<E>, findOptions);
    if (this.hasEmbeddedLists) {
      this.loadAllEmbeddedLists(entities, this.store, "multiple");
    }
    this.installLazyEmbeddedListsForCursor(entities);
    return new MemoryCursor<E>(entities);
  }

  public async clear(_options?: ClearOptions): Promise<void> {
    guardAppendOnly(this.metadata, "clear");

    // For inheritance children, the store table is always keyed by the ROOT entity name.
    const isInheritanceChild = this.metadata.inheritance?.discriminatorValue != null;

    const resolvedName = isInheritanceChild
      ? getEntityName(getEntityMetadata(this.metadata.inheritance!.root).target, {
          namespace: this.namespace,
        })
      : getEntityName(this.metadata.target, { namespace: this.namespace });

    const entityNamespace = resolvedName.namespace ?? null;
    const tableKey = resolvedName.namespace
      ? `${resolvedName.namespace}.${resolvedName.name}`
      : resolvedName.name;

    const table = this.store.tables.get(tableKey);
    if (!table) return;

    // For inheritance children (single-table or joined), delete only rows matching
    // the discriminator value to avoid wiping rows from sibling partitions.
    // Memory driver stores ALL inheritance subtypes in the same root table.
    if (isInheritanceChild) {
      const discField = this.metadata.inheritance!.discriminatorField;
      const discValue = this.metadata.inheritance!.discriminatorValue;

      for (const [pk, row] of table) {
        if (row[discField] === discValue) {
          table.delete(pk);
        }
      }
      return;
    }

    table.clear();

    // Clear associated collection tables for @EmbeddedList fields
    for (const el of this.metadata.embeddedLists) {
      const collectionKey = entityNamespace
        ? `${entityNamespace}.${el.tableName}`
        : el.tableName;
      const collectionTable = this.store.collectionTables.get(collectionKey);
      if (collectionTable) {
        collectionTable.clear();
      }
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

    if (!this.hasEmbeddedLists) {
      const hydrated = await this.executor.executeInsertBulk(prepared);

      for (const entity of hydrated) {
        this.applyLazyRelations(entity, "single");
      }

      return hydrated;
    }

    return await this.withImplicitTransaction(async ({ executor, store }) => {
      const hydrated = await executor.executeInsertBulk(prepared);

      for (let i = 0; i < hydrated.length; i++) {
        this.transferEmbeddedLists(prepared[i], hydrated[i]);
        this.saveAllEmbeddedLists(hydrated[i], store);
      }

      for (const entity of hydrated) {
        this.applyLazyRelations(entity, "single");
      }

      return hydrated;
    });
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

    // Fast path: no relations and no embedded lists
    if (!this.hasRelations && !this.hasEmbeddedLists) {
      await this.fireBeforeHook(hookKind, prepared);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeInsert(prepared);
      await this.fireAfterHook(hookKind, hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
      return hydrated;
    }

    return await this.withImplicitTransaction(
      async ({ executor, repositoryFactory, store }) => {
        const relPersister = this.buildRelationPersister(store, repositoryFactory);
        await relPersister.saveOwning(prepared, "insert");

        await this.fireBeforeHook(hookKind, prepared);
        await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
        const hydrated = await executor.executeInsert(prepared);
        await this.fireAfterHook(hookKind, hydrated);
        await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);

        await relPersister.saveInverse(hydrated, "insert");
        this.saveAllEmbeddedLists(hydrated, store);

        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      },
    );
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

      if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
        return entity;
      }

      if (changed === null) {
        return await this.withImplicitTransaction(
          async ({ executor: _executor, repositoryFactory, store }) => {
            const relPersister = this.buildRelationPersister(store, repositoryFactory);
            await relPersister.saveOwning(entity, "update");
            await relPersister.saveInverse(entity, "update");
            this.saveAllEmbeddedLists(entity, store);
            return entity;
          },
        );
      }
    }

    const prepared = this.entityManager.update(entity);
    this.entityManager.validate(prepared);
    const oldEntity = snapshot ? entity : undefined;
    const updateEvent = { ...this.buildSubscriberEvent(prepared), oldEntity };

    if (!this.hasRelations && !this.hasEmbeddedLists) {
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

    return await this.withImplicitTransaction(
      async ({ executor, repositoryFactory, store }) => {
        const relPersister = this.buildRelationPersister(store, repositoryFactory);
        await relPersister.saveOwning(prepared, "update");

        await this.fireBeforeHook(hookKind, prepared);
        await this.fireSubscriber("beforeUpdate", {
          ...this.buildSubscriberEvent(prepared),
          oldEntity,
        });
        const hydrated = await executor.executeUpdate(prepared);
        await this.fireAfterHook(hookKind, hydrated);
        await this.fireSubscriber("afterUpdate", {
          ...this.buildSubscriberEvent(hydrated),
          oldEntity,
        });

        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);

        await relPersister.saveInverse(hydrated, "update");
        this.saveAllEmbeddedLists(hydrated, store);

        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      },
    );
  }

  private async updateVersioned(
    entity: E,
    hookKind: "update" | "save" = "update",
  ): Promise<E> {
    const snapshot = getSnapshot(entity);
    if (snapshot) {
      const tempCopy = this.entityManager.copy(entity);
      const changed = diffColumns(tempCopy, this.metadata, snapshot);

      if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
        return entity;
      }

      if (changed === null) {
        return await this.withImplicitTransaction(
          async ({ executor: _executor, repositoryFactory, store }) => {
            const relPersister = this.buildRelationPersister(store, repositoryFactory);
            await relPersister.saveOwning(entity, "update");
            await relPersister.saveInverse(entity, "update");
            this.saveAllEmbeddedLists(entity, store);
            return entity;
          },
        );
      }
    }

    const now = new Date();

    return await this.withImplicitTransaction(
      async ({ executor, repositoryFactory, store }) => {
        const partial = this.entityManager.versionUpdate(entity);

        const versionEndDateField = this.metadata.fields.find(
          (f) => f.decorator === "VersionEndDate",
        );
        if (versionEndDateField) {
          (partial as any)[versionEndDateField.key] = now;
        }

        const pkPredicate = buildPrimaryKeyPredicate(entity, this.metadata);
        await executor.executeUpdateMany(pkPredicate, partial, { systemFilters: false });

        const newVersion = this.entityManager.versionCopy(partial, entity);

        const versionStartDateField = this.metadata.fields.find(
          (f) => f.decorator === "VersionStartDate",
        );
        if (versionStartDateField) {
          (newVersion as any)[versionStartDateField.key] = now;
        }

        this.entityManager.validate(newVersion);

        const txRelPersister = this.buildRelationPersister(store, repositoryFactory);
        await txRelPersister.saveOwning(newVersion, "update");

        const oldEntity = entity;
        await this.fireBeforeHook(hookKind, newVersion);
        await this.fireSubscriber("beforeUpdate", {
          ...this.buildSubscriberEvent(newVersion),
          oldEntity,
        });
        const hydrated = await executor.executeInsert(newVersion);
        await this.fireAfterHook(hookKind, hydrated);
        await this.fireSubscriber("afterUpdate", {
          ...this.buildSubscriberEvent(hydrated),
          oldEntity,
        });

        this.transferRelations(newVersion, hydrated);
        this.transferEmbeddedLists(newVersion, hydrated);

        await txRelPersister.saveInverse(hydrated, "update");
        this.saveAllEmbeddedLists(hydrated, store);

        this.applyLazyRelations(hydrated, "single");
        clearSnapshot(entity);

        return hydrated;
      },
    );
  }

  protected async cloneOne(entity: E): Promise<E> {
    const cloned = await this.entityManager.clone(entity);
    this.entityManager.validate(cloned);

    if (!this.hasRelations && !this.hasEmbeddedLists) {
      await this.entityManager.beforeInsert(cloned);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(cloned));
      const hydrated = await this.executor.executeInsert(cloned);
      await this.entityManager.afterInsert(hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
      return hydrated;
    }

    return await this.withImplicitTransaction(
      async ({ executor, repositoryFactory, store }) => {
        const relPersister = this.buildRelationPersister(store, repositoryFactory);
        await relPersister.saveOwning(cloned, "insert");

        await this.entityManager.beforeInsert(cloned);
        await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(cloned));
        const hydrated = await executor.executeInsert(cloned);
        await this.entityManager.afterInsert(hydrated);
        await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

        this.transferRelations(cloned, hydrated);
        this.transferEmbeddedLists(cloned, hydrated);

        await relPersister.saveInverse(hydrated, "insert");
        this.saveAllEmbeddedLists(hydrated, store);

        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      },
    );
  }

  protected async destroyOne(entity: E): Promise<void> {
    await this.entityManager.beforeDestroy(entity);
    await this.fireSubscriber("beforeDestroy", this.buildSubscriberEvent(entity));

    if (!this.hasRelations && !this.hasEmbeddedLists) {
      await this.executor.executeDelete(buildPrimaryKeyPredicate(entity, this.metadata));
      await this.entityManager.afterDestroy(entity);
      await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
      clearSnapshot(entity);
      return;
    }

    await this.withImplicitTransaction(async ({ executor, repositoryFactory, store }) => {
      await this.buildRelationPersister(store, repositoryFactory).destroy(entity);
      this.deleteAllEmbeddedLists(entity, store);

      await executor.executeDelete(buildPrimaryKeyPredicate(entity, this.metadata));
    });

    await this.entityManager.afterDestroy(entity);
    await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

  protected async softDestroyOne(entity: E): Promise<void> {
    await this.entityManager.beforeSoftDestroy(entity);
    await this.fireSubscriber("beforeSoftDestroy", this.buildSubscriberEvent(entity));

    if (!this.hasRelations && !this.hasEmbeddedLists) {
      await this.executor.executeSoftDelete(
        buildPrimaryKeyPredicate(entity, this.metadata),
      );
      await this.entityManager.afterSoftDestroy(entity);
      await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
      clearSnapshot(entity);
      return;
    }

    await this.withImplicitTransaction(async ({ executor, repositoryFactory, store }) => {
      await this.buildRelationPersister(store, repositoryFactory).destroy(entity, true);

      // Collection table rows are intentionally preserved during soft-delete.
      // The parent row still exists (just flagged), so collection rows remain
      // correctly associated. This allows restore() to recover embedded list data.

      await executor.executeSoftDelete(buildPrimaryKeyPredicate(entity, this.metadata));
    });

    await this.entityManager.afterSoftDestroy(entity);
    await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

  protected async upsertOne(entity: E, _options?: UpsertOptions<E>): Promise<E> {
    const prepared = await this.entityManager.insert(entity);
    this.entityManager.validate(prepared);

    const pk = buildPrimaryKeyPredicate(prepared, this.metadata);
    const entityExists = await this.exists(pk);

    // Fast path: no relations and no embedded lists
    if (!this.hasRelations && !this.hasEmbeddedLists) {
      if (entityExists) {
        const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
        if (versionField) {
          const stored = await this.executor.executeFind(pk, { limit: 1 });
          if (stored.length > 0) {
            const storedVersion = (stored[0] as any)[versionField.key] as number;
            (prepared as any)[versionField.key] = storedVersion + 1;
          }
        }
        return this.executor.executeUpdate(prepared);
      }

      return this.executor.executeInsert(prepared);
    }

    return await this.withImplicitTransaction(
      async ({ executor, repositoryFactory, store }) => {
        if (entityExists) {
          const versionField = this.metadata.fields.find(
            (f) => f.decorator === "Version",
          );
          if (versionField) {
            const stored = await executor.executeFind(pk, { limit: 1 });
            if (stored.length > 0) {
              const storedVersion = (stored[0] as any)[versionField.key] as number;
              (prepared as any)[versionField.key] = storedVersion + 1;
            }
          }

          const relPersister = this.buildRelationPersister(store, repositoryFactory);
          await relPersister.saveOwning(prepared, "update");
          const hydrated = await executor.executeUpdate(prepared);
          this.transferRelations(prepared, hydrated);
          this.transferEmbeddedLists(prepared, hydrated);
          await relPersister.saveInverse(hydrated, "update");
          this.saveAllEmbeddedLists(hydrated, store);
          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        }

        const relPersister = this.buildRelationPersister(store, repositoryFactory);
        await relPersister.saveOwning(prepared, "insert");
        const hydrated = await executor.executeInsert(prepared);
        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);
        await relPersister.saveInverse(hydrated, "insert");
        this.saveAllEmbeddedLists(hydrated, store);
        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      },
    );
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
    return error instanceof MemoryDuplicateKeyError;
  }

  // ─── Private: memory-specific helpers ─────────────────────────────

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

      // Skip if parent is the same target to avoid circular loading
      if (this.parent === relation.foreignConstructor()) continue;

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
        r.key === relation.foreignKey,
    );

    // Determine which side owns the join table (has joinKeys)
    const owningJoinKeys = relation.joinKeys ?? inverseRelation?.joinKeys;
    const foreignJoinKeys = inverseRelation?.joinKeys ?? relation.joinKeys;

    if (!owningJoinKeys || !foreignJoinKeys) return [];

    // When relation.joinKeys is null (inverse side), swap:
    // use findKeys for WHERE (they map our PK to join columns) and
    // owning side's joinKeys for SELECT (they map foreign PK to join columns)
    const whereJoinKeys = relation.joinKeys ?? relation.findKeys!;
    const selectJoinKeys = relation.joinKeys ? foreignJoinKeys : owningJoinKeys;

    if (!whereJoinKeys || !selectJoinKeys) return [];

    const joinTableName = relation.joinTable as string;
    const joinName = getJoinName(joinTableName, { namespace: this.namespace });
    const joinKey = joinName.namespace
      ? `${joinName.namespace}.${joinName.name}`
      : joinName.name;

    const joinTable = this.store.joinTables.get(joinKey);
    if (!joinTable) return [];

    // Find join rows matching this entity using WHERE keys
    const whereEntries = Object.entries(whereJoinKeys);

    const matchingRows: Array<Record<string, unknown>> = [];
    for (const [, row] of joinTable) {
      const matches = whereEntries.every(
        ([joinCol, entityKey]) => row[joinCol] === (entity as any)[entityKey],
      );
      if (matches) {
        matchingRows.push(row);
      }
    }

    if (matchingRows.length === 0) return [];

    // Find foreign entities by their PKs using SELECT keys
    const selectEntries = Object.entries(selectJoinKeys);
    const foreignPkKeys = Object.values(selectJoinKeys);
    const repo = this.repositoryFactory(foreignTarget, this.metadata.target);

    if (foreignPkKeys.length === 1) {
      const pkKey = foreignPkKeys[0];
      const joinCol = selectEntries[0][0];
      const pks = matchingRows.map((r) => r[joinCol]);
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return repo.find({ [pkKey]: { $in: pks } }, orderOpts);
    }

    // Composite PK fallback
    const entities: Array<IEntity> = [];
    for (const row of matchingRows) {
      const filter: Record<string, unknown> = {};
      for (let i = 0; i < foreignPkKeys.length; i++) {
        filter[foreignPkKeys[i]] = row[selectEntries[i][0]];
      }
      const found = await repo.findOne(filter);
      if (found) entities.push(found);
    }
    return entities;
  }

  private async loadRelationIdsAndCounts(entities: Array<E>): Promise<void> {
    for (const entity of entities) {
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
    }
  }

  private buildRelationPersister(
    storeOverride?: MemoryStore,
    repositoryFactoryOverride?: RepositoryFactory,
  ): RelationPersister {
    return new RelationPersister({
      metadata: this.metadata,
      namespace: this.namespace,
      parent: this.parent,
      repositoryFactory: repositoryFactoryOverride ?? this.repositoryFactory,
      joinTableOps: createMemoryJoinTableOps(() => storeOverride ?? this.store),
      logger: this.logger,
    });
  }

  // ─── Private: Embedded list helpers ────────────────────────────────

  private transferEmbeddedLists(source: E, target: E): void {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      (target as any)[el.key] = (source as any)[el.key];
    }
  }

  private get embeddedListNamespace(): string | null {
    return this.metadata.entity.namespace ?? this.namespace;
  }

  private saveAllEmbeddedLists(entity: E, store: MemoryStore): void {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      saveMemoryEmbeddedListRows(entity, el, store, this.embeddedListNamespace);
    }
  }

  private loadAllEmbeddedLists(
    entities: Array<E>,
    store: MemoryStore,
    scope: QueryScope,
  ): void {
    if (!this.hasEmbeddedLists) return;
    for (const entity of entities) {
      for (const el of this.metadata.embeddedLists) {
        if (el.loading[scope] === "lazy") continue;
        loadMemoryEmbeddedListRows(entity, el, store, this.embeddedListNamespace);
      }
    }
  }

  private installLazyEmbeddedListsForCursor(entities: Array<E>): void {
    if (!this.hasEmbeddedLists) return;
    const loader = this.buildLazyEmbeddedListLoader();
    if (!loader) return;
    for (const entity of entities) {
      installLazyEmbeddedLists(
        entity,
        this.metadata,
        { loadEmbeddedList: loader },
        "multiple",
      );
    }
  }

  protected override loadEmbeddedListForEntity(
    entity: E,
    embeddedList: MetaEmbeddedList,
  ): void {
    loadMemoryEmbeddedListRows(
      entity,
      embeddedList,
      this.store,
      this.embeddedListNamespace,
    );
  }

  private deleteAllEmbeddedLists(entity: E, store: MemoryStore): void {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      deleteMemoryEmbeddedListRows(entity, el, store, this.embeddedListNamespace);
    }
  }
}
