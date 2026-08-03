import type { IAmphora } from "@lindorm/amphora";
import type { Condition } from "@lindorm/match";
import type { Db, ClientSession } from "mongodb";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial } from "@lindorm/types";
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
import type {
  EntityMetadata,
  MetaRelation,
  QueryScope,
} from "../../../entity/types/metadata.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { AggregateFunction } from "../../../types/aggregate.js";
import type { LazyRelationLoader } from "../../../entity/utils/install-lazy-relations.js";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { ProteusHookMeta } from "../../../../types/proteus-hook-meta.js";
import type { PaginateOptions } from "../../../../types/paginate-options.js";
import type { KeysetOrderEntry } from "../../../utils/pagination/build-keyset-order.js";
import type { JoinTableOps } from "../../../types/join-table-ops.js";
import { getForeignMetadata } from "../../../entity/metadata/foreign-metadata.js";
import { DriverRepositoryBase } from "../../../classes/DriverRepositoryBase.js";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate.js";
import {
  guardAppendOnly,
  guardVersionFields,
  validateRelationNames,
} from "../../../utils/repository/repository-guards.js";
import { RelationPersister } from "../../../utils/repository/RelationPersister.js";
import { buildRelationFilter } from "../../../utils/repository/build-relation-filter.js";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections.js";
import { guardFindSortKey } from "../../../utils/query/guard-find-sort-key.js";
import { executePaginateFindInMemory } from "../../../utils/pagination/execute-paginate-find-in-memory.js";
import { getSnapshot, clearSnapshot } from "../../../entity/utils/snapshot-store.js";
import { diffColumns } from "../../../entity/utils/diff-columns.js";
import { retainReadonlyFields } from "../../../entity/utils/retain-readonly-fields.js";
import { NotSupportedError } from "../../../../errors/NotSupportedError.js";
import { MongoDuplicateKeyError } from "../errors/MongoDuplicateKeyError.js";
import {
  saveMongoEmbeddedListRows,
  loadMongoEmbeddedListRows,
  loadMongoEmbeddedListRowsBatch,
  deleteMongoEmbeddedListRows,
} from "../utils/embedded-list-ops.js";
import type { MetaEmbeddedList } from "../../../entity/types/metadata.js";
import { resolveCollectionName } from "../utils/resolve-collection-name.js";
import { MongoCursor } from "./MongoCursor.js";
import { compileFilterWithSystem } from "../utils/compile-filter.js";
import { compileSort } from "../utils/compile-sort.js";
import { compileProjection } from "../utils/compile-projection.js";
import { flattenEmbeddedCriteria } from "../../../utils/query/flatten-embedded-criteria.js";
import { resolveColumnNameSafe } from "../../../utils/sql/resolve-column-name.js";

export type MongoRepositorySettings<E extends IEntity> = {
  target: Constructor<E>;
  metadata?: EntityMetadata;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  db: Db;
  namespace: string | null;
  logger: ILogger;
  meta?: ProteusHookMeta;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  emitEntity?: EntityEmitFn;
  joinTableOps: JoinTableOps;
  session?: ClientSession;
  amphora?: IAmphora;
};

export class MongoRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> extends DriverRepositoryBase<E, O> {
  private readonly db: Db;
  private readonly hasEagerRelations: boolean;
  private readonly hasEmbeddedLists: boolean;
  private readonly hasReadonlyUpdateFields: boolean;
  private readonly joinTableOps: JoinTableOps;
  private readonly session: ClientSession | undefined;
  private readonly amphora: IAmphora | undefined;

  constructor(options: MongoRepositorySettings<E>) {
    super({
      target: options.target,
      metadata: options.metadata,
      executor: options.executor,
      queryBuilderFactory: options.queryBuilderFactory,
      namespace: options.namespace,
      logger: options.logger,
      driver: "mongo",
      driverLabel: "MongoRepository",
      meta: options.meta,
      parent: options.parent,
      repositoryFactory: options.repositoryFactory,
      emitEntity: options.emitEntity,
    });

    this.db = options.db;
    this.joinTableOps = options.joinTableOps;
    this.session = options.session;
    this.amphora = options.amphora;
    this.hasEagerRelations = this.metadata.relations.some(
      (r) =>
        r.options.loading.single === "eager" || r.options.loading.multiple === "eager",
    );
    this.hasEmbeddedLists = (this.metadata.embeddedLists ?? []).length > 0;
    // Only user @Field columns marked read-only on "update" require the pre-write
    // read to retain their stored value; framework-managed readonly fields (Scope,
    // CreateDate, …) already carry the correct value on the in-memory entity.
    this.hasReadonlyUpdateFields = this.metadata.fields.some(
      (f) => f.decorator === "Field" && f.readonly.includes("update"),
    );
  }

  // ─── Abstract: find / versions ────────────────────────────────────

  async find(
    criteria?: Condition<E>,
    options?: FindOptions<E>,
    scope: QueryScope = "multiple",
  ): Promise<Array<E>> {
    guardFindSortKey(options);

    if (options?.relations) {
      validateRelationNames(this.metadata, options.relations as Array<string>);
    }

    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      [scope],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const entities = await this.executor.executeFind(
      criteria ?? ({} as Condition<E>),
      effectiveOptions ?? {},
    );

    if (this.hasAsyncRelationIds || this.hasRelationCounts) {
      await this.loadRelationIdsAndCounts(entities);
    }

    if (this.hasEmbeddedLists) {
      await this.loadAllEmbeddedLists(entities, scope);
    }

    for (const entity of entities) {
      if (this.hasEagerRelations || options?.relations) {
        await this.loadEagerRelations(entity, scope, options?.relations as Array<string>);
      }
      this.applyLazyRelations(entity, scope);
      await this.entityManager.afterLoad(entity);
      await this.fireSubscriber("afterLoad", this.buildSubscriberEvent(entity));
    }

    return entities;
  }

  /**
   * Query all versions of a versioned entity from the main collection.
   * Version-keyed entities store all versions as separate rows in the
   * main collection (differentiated by composite PK: id + versionId).
   */
  async versions(criteria: Condition<E>, options?: FindOptions<E>): Promise<Array<E>> {
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
      await this.loadAllEmbeddedLists(entities, "multiple");
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

  protected override async executePaginateFind(
    criteria: Condition<E>,
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

  async cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>> {
    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      ["multiple"],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);

    // Build filter
    const criteria = effectiveOptions?.where ?? ({} as Condition<E>);
    const filter = compileFilterWithSystem(criteria, this.metadata, new Map(), {
      withDeleted: effectiveOptions?.withDeleted,
    });

    const sessionOpts = this.session ? { session: this.session } : undefined;
    let mongoCursor = collection.find(filter, sessionOpts);

    // Apply sort
    const order = effectiveOptions?.orderBy;
    if (order) {
      const sort = compileSort(order as Record<string, "ASC" | "DESC">, this.metadata);
      if (sort) mongoCursor = mongoCursor.sort(sort);
    }

    // Apply projection
    const select = effectiveOptions?.select as Array<string> | undefined;
    if (select && select.length > 0) {
      const projection = compileProjection(select, this.metadata);
      if (projection) mongoCursor = mongoCursor.project(projection);
    }

    return new MongoCursor<E>(mongoCursor, this.metadata, this.amphora);
  }

  async clear(_options?: ClearOptions): Promise<void> {
    guardAppendOnly(this.metadata, "clear");

    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);

    // For single-table inheritance children, scope by discriminator
    const isSingleTableChild =
      this.metadata.inheritance?.strategy === "single-table" &&
      this.metadata.inheritance.discriminatorValue != null;

    if (isSingleTableChild) {
      const discField = this.metadata.inheritance!.discriminatorField;
      const discValue = this.metadata.inheritance!.discriminatorValue;
      const field = this.metadata.fields.find((f) => f.key === discField);
      const mongoField = field?.name ?? discField;

      await collection.deleteMany(
        { [mongoField]: discValue },
        this.session ? { session: this.session } : undefined,
      );
      return;
    }

    await collection.deleteMany({}, this.session ? { session: this.session } : undefined);

    // Clear join collections for M2M relations
    for (const relation of this.metadata.relations) {
      if (relation.type !== "ManyToMany" || typeof relation.joinTable !== "string")
        continue;
      const joinCollection = this.db.collection(relation.joinTable);
      await joinCollection.deleteMany(
        {},
        this.session ? { session: this.session } : undefined,
      );
    }

    // Clear embedded list collections
    for (const el of this.metadata.embeddedLists) {
      const elCollection = this.db.collection(el.tableName);
      await elCollection.deleteMany(
        {},
        this.session ? { session: this.session } : undefined,
      );
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

    if (!this.hasRelations && !this.hasEmbeddedLists) {
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
    this.transferEmbeddedLists(prepared, hydrated);

    await relPersister.saveInverse(hydrated, "insert");
    await this.saveAllEmbeddedLists(hydrated);

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

  /**
   * Mongo overwrites the whole document on update, so a `@ReadOnly("update")`
   * user field would be clobbered by the wholesale write. Read the stored row
   * and pin those columns back onto `prepared` — a no-op write for them. The
   * read is skipped entirely unless the entity declares readonly-on-update
   * fields.
   */
  private async retainReadonlyOnUpdate(prepared: E): Promise<void> {
    if (!this.hasReadonlyUpdateFields) return;

    const pk = buildPrimaryKeyPredicate(prepared, this.metadata);
    const stored = await this.executor.executeFind(pk, { limit: 1 });
    const existingRow = stored[0] as Record<string, unknown> | undefined;
    if (existingRow) {
      retainReadonlyFields(prepared, existingRow, this.metadata, "update");
    }
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
        const relPersister = this.buildRelationPersister();
        await relPersister.saveOwning(entity, "update");
        await relPersister.saveInverse(entity, "update");
        await this.saveAllEmbeddedLists(entity);
        return entity;
      }
    }

    const prepared = this.entityManager.update(entity);
    this.entityManager.validate(prepared);
    await this.retainReadonlyOnUpdate(prepared);
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
    this.transferEmbeddedLists(prepared, hydrated);

    await relPersister.saveInverse(hydrated, "update");
    await this.saveAllEmbeddedLists(hydrated);

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

      if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
        return entity;
      }

      if (changed === null) {
        const relPersister = this.buildRelationPersister();
        await relPersister.saveOwning(entity, "update");
        await relPersister.saveInverse(entity, "update");
        await this.saveAllEmbeddedLists(entity);
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
    this.transferEmbeddedLists(newVersion, hydrated);

    await relPersister.saveInverse(hydrated, "update");
    await this.saveAllEmbeddedLists(hydrated);

    this.applyLazyRelations(hydrated, "single");
    clearSnapshot(entity);

    return hydrated;
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

    const relPersister = this.buildRelationPersister();
    await relPersister.saveOwning(cloned, "insert");

    await this.entityManager.beforeInsert(cloned);
    await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(cloned));
    const hydrated = await this.executor.executeInsert(cloned);
    await this.entityManager.afterInsert(hydrated);
    await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

    this.transferRelations(cloned, hydrated);
    this.transferEmbeddedLists(cloned, hydrated);

    await relPersister.saveInverse(hydrated, "insert");
    await this.saveAllEmbeddedLists(hydrated);

    this.applyLazyRelations(hydrated, "single");
    return hydrated;
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

    const relPersister = this.buildRelationPersister();
    await relPersister.destroy(entity);

    await this.executor.executeDelete(buildPrimaryKeyPredicate(entity, this.metadata));

    await this.deleteAllEmbeddedLists(entity);

    await this.entityManager.afterDestroy(entity);
    await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

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
    await relPersister.destroy(entity, true);

    await this.executor.executeSoftDelete(
      buildPrimaryKeyPredicate(entity, this.metadata),
    );

    await this.entityManager.afterSoftDestroy(entity);
    await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
    clearSnapshot(entity);
  }

  protected async upsertOne(entity: E, _options?: UpsertOptions<E>): Promise<E> {
    if (_options?.conflictOn && _options.conflictOn.length > 0) {
      throw new NotSupportedError(
        "MongoDB driver does not support upsert with conflictOn. " +
          "Use PK-based upsert or a driver with unique constraint support.",
        {
          code: "unsupported_operation",
          title: "Unsupported Operation",
          details:
            "The MongoDB driver only supports primary-key-based upsert; the conflictOn option is not available.",
        },
      );
    }

    const prepared = await this.entityManager.insert(entity);
    this.entityManager.validate(prepared);

    const pk = buildPrimaryKeyPredicate(prepared, this.metadata);
    const entityExists = await this.exists(pk);

    if (!this.hasRelations && !this.hasEmbeddedLists) {
      if (entityExists) {
        const stored = await this.executor.executeFind(pk, { limit: 1 });
        const existingRow = stored[0] as Record<string, unknown> | undefined;
        if (existingRow) {
          retainReadonlyFields(prepared, existingRow, this.metadata, "upsert");
        }
        const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
        if (versionField && existingRow) {
          (prepared as any)[versionField.key] =
            ((existingRow as any)[versionField.key] as number) + 1;
        }
        await this.fireBeforeHook("update", prepared);
        await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
        const hydrated = await this.executor.executeUpdate(prepared);
        await this.fireAfterHook("update", hydrated);
        await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));
        return hydrated;
      }

      try {
        await this.fireBeforeHook("insert", prepared);
        await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
        const hydrated = await this.executor.executeInsert(prepared);
        await this.fireAfterHook("insert", hydrated);
        await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));
        return hydrated;
      } catch (error) {
        if (error instanceof MongoDuplicateKeyError) {
          // Race condition: another process inserted between exists() and insert().
          // Fall through to update path.
          await this.fireBeforeHook("update", prepared);
          await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
          const hydrated = await this.executor.executeUpdate(prepared);
          await this.fireAfterHook("update", hydrated);
          await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));
          return hydrated;
        }
        throw error;
      }
    }

    const relPersister = this.buildRelationPersister();

    if (entityExists) {
      const stored = await this.executor.executeFind(pk, { limit: 1 });
      const existingRow = stored[0] as Record<string, unknown> | undefined;
      if (existingRow) {
        retainReadonlyFields(prepared, existingRow, this.metadata, "upsert");
      }
      const versionField = this.metadata.fields.find((f) => f.decorator === "Version");
      if (versionField && existingRow) {
        (prepared as any)[versionField.key] =
          ((existingRow as any)[versionField.key] as number) + 1;
      }

      await relPersister.saveOwning(prepared, "update");

      await this.fireBeforeHook("update", prepared);
      await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeUpdate(prepared);
      await this.fireAfterHook("update", hydrated);
      await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));

      this.transferRelations(prepared, hydrated);
      this.transferEmbeddedLists(prepared, hydrated);
      await relPersister.saveInverse(hydrated, "update");
      await this.saveAllEmbeddedLists(hydrated);
      this.applyLazyRelations(hydrated, "single");
      return hydrated;
    }

    try {
      await relPersister.saveOwning(prepared, "insert");

      await this.fireBeforeHook("insert", prepared);
      await this.fireSubscriber("beforeInsert", this.buildSubscriberEvent(prepared));
      const hydrated = await this.executor.executeInsert(prepared);
      await this.fireAfterHook("insert", hydrated);
      await this.fireSubscriber("afterInsert", this.buildSubscriberEvent(hydrated));

      this.transferRelations(prepared, hydrated);
      this.transferEmbeddedLists(prepared, hydrated);
      await relPersister.saveInverse(hydrated, "insert");
      await this.saveAllEmbeddedLists(hydrated);
      this.applyLazyRelations(hydrated, "single");
      return hydrated;
    } catch (error) {
      if (error instanceof MongoDuplicateKeyError) {
        // Race condition: another process inserted between exists() and insert().
        // Fall through to update path.
        await relPersister.saveOwning(prepared, "update");

        await this.fireBeforeHook("update", prepared);
        await this.fireSubscriber("beforeUpdate", this.buildSubscriberEvent(prepared));
        const hydrated = await this.executor.executeUpdate(prepared);
        await this.fireAfterHook("update", hydrated);
        await this.fireSubscriber("afterUpdate", this.buildSubscriberEvent(hydrated));

        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);
        await relPersister.saveInverse(hydrated, "update");
        await this.saveAllEmbeddedLists(hydrated);
        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      }
      throw error;
    }
  }

  // ─── Abstract: aggregates ─────────────────────────────────────────

  protected async executeAggregate(
    type: AggregateFunction,
    field: keyof E,
    criteria?: Condition<E>,
  ): Promise<number | null> {
    const collectionName = resolveCollectionName(this.metadata);
    const collection = this.db.collection(collectionName);

    const flatCriteria = flattenEmbeddedCriteria(
      criteria ?? ({} as Condition<E>),
      this.metadata,
    );
    const filter = compileFilterWithSystem(flatCriteria, this.metadata, new Map());

    // Resolve MongoDB field name (PK → _id)
    const fieldKey = field as string;
    const isPk = this.metadata.primaryKeys.includes(fieldKey);
    let mongoField: string;
    if (isPk) {
      mongoField = this.metadata.primaryKeys.length === 1 ? "_id" : `_id.${fieldKey}`;
    } else {
      // Relations are passed so an auto-projected FK resolves to the document key
      // it was written under; a bare field lookup fell back to the property key,
      // which under a renaming strategy addresses a key that does not exist and
      // silently aggregates nothing.
      mongoField = resolveColumnNameSafe(
        this.metadata.fields,
        fieldKey,
        this.metadata.relations,
      );
    }

    // Map AggregateFunction to MongoDB operator
    const fnMap: Record<AggregateFunction, string> = {
      sum: "$sum",
      avg: "$avg",
      min: "$min",
      max: "$max",
    };
    const mongoOp = fnMap[type];

    const pipeline: Array<Record<string, unknown>> = [];

    if (Object.keys(filter).length > 0) {
      pipeline.push({ $match: filter });
    }

    pipeline.push({
      $group: {
        _id: null,
        result: { [mongoOp]: `$${mongoField}` },
      },
    });

    const sessionOpts = this.session ? { session: this.session } : undefined;
    const docs = await collection.aggregate(pipeline, sessionOpts).toArray();

    if (docs.length === 0) return null;

    // The accumulator hands back whatever BSON type the column holds — a bigint
    // column aggregates to a JS bigint, a decimal to a Decimal128 — but the
    // aggregate contract is `number | null` on every driver, and the SQL ones
    // already narrow the same way.
    const raw = docs[0].result;
    return raw != null ? Number(raw) : null;
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
      const filter = buildRelationFilter(
        relation,
        entity,
        this.metadata,
        getForeignMetadata(relation, foreignTarget),
      );
      const isCol = relation.type === "OneToMany";
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return isCol ? repo.find(filter, orderOpts) : repo.findOne(filter);
    };
  }

  protected isDuplicateKeyError(error: unknown): boolean {
    return error instanceof MongoDuplicateKeyError;
  }

  // ─── Private ──────────────────────────────────────────────────────

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
    const foreignMeta = getForeignMetadata(relation, foreignTarget);

    const inverseRelation = foreignMeta.relations.find(
      (r) =>
        r.type === "ManyToMany" &&
        r.foreignKey === relation.key &&
        r.key === relation.foreignKey &&
        r.joinTable === relation.joinTable,
    );

    if (!relation.findKeys || !inverseRelation?.findKeys) return [];

    const joinTableName = relation.joinTable as string;
    const joinCollection = this.db.collection(joinTableName);

    const whereEntries = Object.entries(relation.findKeys);
    const selectJoinKeys = inverseRelation.findKeys;
    const foreignPkKeys = Object.values(selectJoinKeys);

    // Build compound filter using ALL FK entries (supports composite keys)
    const whereFilter: Record<string, unknown> = {};
    for (const [whereCol, whereEntityKey] of whereEntries) {
      whereFilter[whereCol] = (entity as any)[whereEntityKey];
    }

    // Query join collection for all matching entries
    const joinDocs = await joinCollection
      .find(whereFilter, this.session ? { session: this.session } : undefined)
      .toArray();

    if (joinDocs.length === 0) return [];

    // Extract target PK values using all foreign-side join keys
    const targetCols = Object.keys(selectJoinKeys);
    const targetPkValues = joinDocs.map((d) => {
      if (targetCols.length === 1) return d[targetCols[0]];
      const compound: Record<string, unknown> = {};
      for (const col of targetCols) {
        compound[col] = d[col];
      }
      return compound;
    });

    if (targetPkValues.length === 0) return [];

    const repo = this.repositoryFactory(foreignTarget, this.metadata.target);

    if (foreignPkKeys.length === 1) {
      const pkKey = foreignPkKeys[0];
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return repo.find({ [pkKey]: { $in: targetPkValues } }, orderOpts);
    }

    // Composite PK fallback
    const entities: Array<IEntity> = [];
    for (const pk of targetPkValues) {
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
        for (const ri of this.metadata.relationIds ?? []) {
          const relation = this.metadata.relations.find((r) => r.key === ri.relationKey);
          if (!relation) continue;

          if (relation.joinKeys && relation.type !== "ManyToMany") continue;

          if (relation.type === "ManyToMany") {
            const items = await this.loadManyToManyLazy(entity, relation);
            const foreignTarget = relation.foreignConstructor();
            const foreignMeta = getForeignMetadata(relation, foreignTarget);
            const pkKey = ri.column ?? foreignMeta.primaryKeys[0];
            (entity as any)[ri.key] = items.map((item) => (item as any)[pkKey]);
          } else {
            const foreignTarget = relation.foreignConstructor();
            const filter = buildRelationFilter(
              relation,
              entity,
              this.metadata,
              getForeignMetadata(relation, foreignTarget),
            );
            const repo = this.repositoryFactory(foreignTarget, this.metadata.target);
            const found = await repo.findOne(filter);
            if (found) {
              const foreignMeta = getForeignMetadata(relation, foreignTarget);
              const pkKey = ri.column ?? foreignMeta.primaryKeys[0];
              (entity as any)[ri.key] = (found as any)[pkKey];
            }
          }
        }

        for (const rc of this.metadata.relationCounts ?? []) {
          const relation = this.metadata.relations.find((r) => r.key === rc.relationKey);
          if (!relation) continue;

          if (relation.type === "ManyToMany") {
            const items = await this.loadManyToManyLazy(entity, relation);
            (entity as any)[rc.key] = items.length;
          } else if (relation.type === "OneToMany") {
            const foreignTarget = relation.foreignConstructor();
            const filter = buildRelationFilter(
              relation,
              entity,
              this.metadata,
              getForeignMetadata(relation, foreignTarget),
            );
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
      joinTableOps: this.joinTableOps,
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

  private async saveAllEmbeddedLists(entity: E): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      await saveMongoEmbeddedListRows(entity, el, this.db, this.session);
    }
  }

  private async loadAllEmbeddedLists(
    entities: Array<E>,
    scope: QueryScope,
  ): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      if (el.loading[scope] === "lazy") continue;
      await loadMongoEmbeddedListRowsBatch(entities, el, this.db, this.session);
    }
  }

  protected override async loadEmbeddedListForEntity(
    entity: E,
    embeddedList: MetaEmbeddedList,
  ): Promise<void> {
    await loadMongoEmbeddedListRows(entity, embeddedList, this.db, this.session);
  }

  private async deleteAllEmbeddedLists(entity: E): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      await deleteMongoEmbeddedListRows(entity, el, this.db, this.session);
    }
  }
}
