import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError.js";
import type {
  IEntity,
  IProteusCursor,
  IProteusQueryBuilder,
} from "../../../../interfaces/index.js";
import type {
  ClearOptions,
  CursorOptions,
  DeleteOptions,
  FindOptions,
  UpsertOptions,
} from "../../../../types/index.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type { MetaRelation, QueryScope } from "../../../entity/types/metadata.js";
import type { QueryState } from "../../../types/query.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { AggregateFunction } from "../../../types/aggregate.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { fanout } from "../../../utils/parallel.js";
import { DriverRepositoryBase } from "../../../classes/DriverRepositoryBase.js";
import { createEmptyState } from "../../../../classes/QueryBuilder.js";
import { compileAggregate } from "../utils/query/compile-aggregate.js";
import type { AggregateType } from "../utils/query/compile-aggregate.js";
import {
  compileUpsert,
  type UpsertCompileOptions,
} from "../utils/query/compile-upsert.js";
import { compileInsertBulk } from "../utils/query/compile-insert.js";
import { compileQuery } from "../utils/query/compile-query.js";
import {
  compileJoinedPartialUpdate,
  compilePartialUpdate,
} from "../utils/query/compile-partial-update.js";
import { hydrateReturning } from "../utils/query/hydrate-returning.js";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate.js";
import {
  guardAppendOnly,
  guardDeleteDateField,
  guardVersionFields,
  validateRelationNames,
} from "../../../utils/repository/repository-guards.js";
import { wrapPgError } from "../utils/repository/wrap-pg-error.js";
import { RelationPersister } from "../../../utils/repository/RelationPersister.js";
import { createPostgresJoinTableOps } from "../utils/repository/postgres-join-table-ops.js";
import type { LazyRelationLoader } from "../../../entity/utils/install-lazy-relations.js";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { ProteusHookMeta } from "../../../../types/proteus-hook-meta.js";
import { buildRelationFilter } from "../../../utils/repository/build-relation-filter.js";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier.js";
import { resolveTableName } from "../utils/query/resolve-table-name.js";
import { DuplicateKeyError } from "../../../errors/DuplicateKeyError.js";
import { PostgresCursor } from "./PostgresCursor.js";
import { getSnapshot, clearSnapshot } from "../../../entity/utils/snapshot-store.js";
import { diffColumns } from "../../../entity/utils/diff-columns.js";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections.js";
import { loadRelationIds } from "../utils/repository/load-relation-ids.js";
import { loadRelationCounts } from "../utils/repository/load-relation-counts.js";
import {
  saveEmbeddedListRows,
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops.js";
import type { MetaEmbeddedList } from "../../../entity/types/metadata.js";

export type { RepositoryFactory } from "../../../types/repository-factory.js";

export type WithImplicitTransaction<E extends IEntity> = <T>(
  fn: (ctx: {
    client: PostgresQueryClient;
    executor: IRepositoryExecutor<E>;
    repositoryFactory: RepositoryFactory;
  }) => Promise<T>,
) => Promise<T>;

export type CreateCursorClient = () => Promise<{
  client: import("pg").PoolClient;
  release: () => void;
}>;

export type PostgresRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  client: PostgresQueryClient;
  namespace: string | null;
  logger: ILogger;
  meta?: ProteusHookMeta;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  withImplicitTransaction: WithImplicitTransaction<E>;
  createCursorClient?: CreateCursorClient;
  emitEntity?: EntityEmitFn;
  amphora?: IAmphora;
};

const PG_AGGREGATE_MAP: Record<AggregateFunction, AggregateType> = {
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
};

export class PostgresRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> extends DriverRepositoryBase<E, O> {
  private readonly client: PostgresQueryClient;
  private readonly withImplicitTransaction: WithImplicitTransaction<E>;
  private readonly createCursorClient: CreateCursorClient | undefined;
  private readonly hasEmbeddedLists: boolean;
  private readonly amphora: IAmphora | undefined;

  public constructor(options: PostgresRepositoryOptions<E>) {
    super({
      target: options.target,
      executor: options.executor,
      queryBuilderFactory: options.queryBuilderFactory,
      namespace: options.namespace,
      logger: options.logger,
      driver: "postgres",
      driverLabel: "PostgresRepository",
      meta: options.meta,
      parent: options.parent,
      repositoryFactory: options.repositoryFactory,
      emitEntity: options.emitEntity,
    });

    this.client = options.client;
    this.withImplicitTransaction = options.withImplicitTransaction;
    this.createCursorClient = options.createCursorClient;
    this.hasEmbeddedLists = (this.metadata.embeddedLists ?? []).length > 0;
    this.amphora = options.amphora;
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
      _scope,
    );

    if (this.hasAsyncRelationIds || this.hasRelationCounts) {
      const loadCtx = {
        metadata: this.metadata,
        namespace: this.namespace,
        client: this.client,
      };
      await fanout(this.client, [
        () =>
          this.hasAsyncRelationIds
            ? loadRelationIds(entities, loadCtx)
            : Promise.resolve(undefined),
        () =>
          this.hasRelationCounts
            ? loadRelationCounts(entities, loadCtx)
            : Promise.resolve(undefined),
      ]);
    }

    if (this.hasEmbeddedLists) {
      await this.loadAllEmbeddedLists(entities, this.client, _scope);
    }

    for (const entity of entities) {
      this.applyLazyRelations(entity, _scope);
      await this.entityManager.afterLoad(entity);
      await this.fireSubscriber(
        "afterLoad",
        this.buildSubscriberEvent(entity, this.client),
      );
    }

    return entities;
  }

  public async versions(
    criteria: Predicate<E>,
    options?: FindOptions<E>,
  ): Promise<Array<E>> {
    guardVersionFields(this.metadata, "versions");

    const entities = await this.executor.executeFind(
      criteria,
      {
        ...options,
        withDeleted: true,
        withAllVersions: true,
      } as FindOptions<E>,
      "multiple",
    );

    if (this.hasAsyncRelationIds || this.hasRelationCounts) {
      const loadCtx = {
        metadata: this.metadata,
        namespace: this.namespace,
        client: this.client,
      };
      await fanout(this.client, [
        () =>
          this.hasAsyncRelationIds
            ? loadRelationIds(entities, loadCtx)
            : Promise.resolve(undefined),
        () =>
          this.hasRelationCounts
            ? loadRelationCounts(entities, loadCtx)
            : Promise.resolve(undefined),
      ]);
    }

    if (this.hasEmbeddedLists) {
      await this.loadAllEmbeddedLists(entities, this.client, "multiple");
    }

    for (const entity of entities) {
      this.applyLazyRelations(entity, "multiple");
      await this.entityManager.afterLoad(entity);
      await this.fireSubscriber(
        "afterLoad",
        this.buildSubscriberEvent(entity, this.client),
      );
    }

    return entities;
  }

  // ─── Override: PG error wrapping ──────────────────────────────────

  public override async delete(
    criteria: Predicate<E>,
    options?: DeleteOptions,
  ): Promise<void> {
    try {
      if (options?.limit) {
        await this.executor.executeDelete(criteria, options);
      } else {
        await this.executor.executeDelete(criteria);
      }
    } catch (error) {
      return wrapPgError(error, `Failed to delete "${this.metadata.entity.name}"`, {
        criteria,
      });
    }
  }

  public override async updateMany(
    criteria: Predicate<E>,
    update: DeepPartial<E>,
  ): Promise<void> {
    if (this.entityManager.updateStrategy === "version") {
      throw new ProteusRepositoryError(
        `updateMany is not supported for versioned entity "${this.metadata.entity.name}". Use update() for individual version updates.`,
        { debug: { entityName: this.metadata.entity.name } },
      );
    }

    this.entityManager.verifyReadonly(update);

    try {
      await this.executor.executeUpdateMany(criteria, update);
    } catch (error) {
      return wrapPgError(error, `Failed to updateMany "${this.metadata.entity.name}"`, {
        criteria,
      });
    }
  }

  public override async softDelete(
    criteria: Predicate<E>,
    _options?: DeleteOptions,
  ): Promise<void> {
    guardDeleteDateField(this.metadata, "softDelete");

    try {
      await this.executor.executeSoftDelete(criteria);
    } catch (error) {
      return wrapPgError(error, `Failed to softDelete "${this.metadata.entity.name}"`, {
        criteria,
      });
    }
  }

  public override async restore(
    criteria: Predicate<E>,
    _options?: DeleteOptions,
  ): Promise<void> {
    guardDeleteDateField(this.metadata, "restore");

    try {
      await this.executor.executeRestore(criteria);
    } catch (error) {
      return wrapPgError(error, `Failed to restore "${this.metadata.entity.name}"`, {
        criteria,
      });
    }
  }

  // ─── Abstract: cursor / clear ─────────────────────────────────────

  public async cursor(options?: CursorOptions<E>): Promise<IProteusCursor<E>> {
    if (!this.createCursorClient) {
      throw new ProteusRepositoryError(
        `cursor() is not available on transactional repositories`,
        { debug: { entityName: this.metadata.entity.name } },
      );
    }

    const hiddenSelect = filterHiddenSelections(
      this.metadata,
      ["multiple"],
      (options?.select as Array<string>) ?? null,
    );
    const effectiveOptions = hiddenSelect
      ? { ...options, select: hiddenSelect as Array<keyof E> }
      : options;

    const state = this.buildCursorQueryState(effectiveOptions);
    const { text, params, aliasMap } = compileQuery(state, this.metadata, this.namespace);

    const { client, release } = await this.createCursorClient();

    return new PostgresCursor<E>({
      sql: text,
      params,
      metadata: this.metadata,
      aliasMap,
      poolClient: client,
      releaseClient: release,
      batchSize: options?.batchSize ?? 100,
      namespace: this.namespace,
    });
  }

  public async clear(options?: ClearOptions): Promise<void> {
    guardAppendOnly(this.metadata, "clear");

    // For inheritance children, always use the ROOT entity's table.
    const { schema, name } = resolveTableName(this.metadata, this.namespace);
    const tableName = quoteQualifiedName(schema, name);

    // For inheritance children (single-table or joined), issue a discriminator-scoped DELETE
    // instead of TRUNCATE to avoid wiping rows from sibling partitions.
    // For joined children, FK CASCADE will clean up the child-specific table.
    const isInheritanceChild = this.metadata.inheritance?.discriminatorValue != null;

    if (isInheritanceChild) {
      const discField = this.metadata.fields.find(
        (f) => f.key === this.metadata.inheritance!.discriminatorField,
      );

      // restartIdentity has no effect with DELETE (only TRUNCATE supports it)
      const params: Array<unknown> = [this.metadata.inheritance!.discriminatorValue];
      const sql = `DELETE FROM ${tableName} WHERE ${quoteIdentifier(discField!.name)} = $1`;
      await this.client.query(sql, params);
      return;
    }

    let sql = `TRUNCATE TABLE ${tableName}`;

    if (options?.restartIdentity) {
      sql += " RESTART IDENTITY";
    }

    if (options?.cascade || this.hasEmbeddedLists) {
      sql += " CASCADE";
    }

    await this.client.query(sql);
  }

  // ─── Abstract: single-entity operations ───────────────────────────

  /**
   * Bulk insert bypasses per-entity lifecycle hooks (@BeforeInsert, @AfterInsert),
   * subscriber events, and relation cascades for throughput.
   * Use `save(entities)` if lifecycle and cascade behavior is required.
   */
  protected async insertBulk(inputs: Array<O | E>): Promise<Array<E>> {
    try {
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

      // For joined inheritance children, fall back to individual inserts
      // (multi-table INSERT cannot be expressed in a single VALUES clause)
      const isJoinedChild =
        this.metadata.inheritance?.strategy === "joined" &&
        this.metadata.inheritance.discriminatorValue != null;

      if (isJoinedChild) {
        // Wrap the loop in a transaction so the entire batch is atomic.
        // Each insertOne calls withImplicitTransaction internally, which
        // will detect the existing transaction and use a SAVEPOINT.
        return await this.withImplicitTransaction(async () => {
          const results: Array<E> = [];
          for (const entity of prepared) {
            results.push(await this.insertOne(entity));
          }
          return results;
        });
      }

      if (!this.hasEmbeddedLists) {
        const { text, params } = compileInsertBulk(
          prepared,
          this.metadata,
          this.namespace,
          this.amphora,
        );
        const result = await this.client.query(text, params);
        const hydrated = result.rows.map((row: any) =>
          hydrateReturning<E>(row, this.metadata, {
            hooks: false,
            amphora: this.amphora,
          }),
        );

        for (const entity of hydrated) {
          this.applyLazyRelations(entity, "single");
        }

        return hydrated;
      }

      return await this.withImplicitTransaction(async ({ client }) => {
        const { text, params } = compileInsertBulk(
          prepared,
          this.metadata,
          this.namespace,
          this.amphora,
        );
        const result = await client.query(text, params);
        const hydrated = result.rows.map((row: any) =>
          hydrateReturning<E>(row, this.metadata, {
            hooks: false,
            amphora: this.amphora,
          }),
        );

        for (let i = 0; i < hydrated.length; i++) {
          this.transferEmbeddedLists(prepared[i], hydrated[i]);
          await this.saveAllEmbeddedLists(hydrated[i], client);
        }

        for (const entity of hydrated) {
          this.applyLazyRelations(entity, "single");
        }

        return hydrated;
      });
    } catch (error) {
      return wrapPgError(error, `Failed to bulk insert "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  protected async insertOne(
    input: O | E,
    hookKind: "insert" | "save" = "insert",
  ): Promise<E> {
    try {
      const entity =
        input instanceof this.entityManager.target
          ? input
          : this.entityManager.create(input);

      const prepared = await this.entityManager.insert(entity);
      this.entityManager.validate(prepared);

      // Fast path: no relations and no embedded lists — skip transaction overhead
      if (!this.hasRelations && !this.hasEmbeddedLists) {
        await this.fireBeforeHook(hookKind, prepared);
        await this.fireSubscriber(
          "beforeInsert",
          this.buildSubscriberEvent(prepared, this.client),
        );
        const hydrated = await this.executor.executeInsert(prepared);
        await this.fireAfterHook(hookKind, hydrated);
        await this.fireSubscriber(
          "afterInsert",
          this.buildSubscriberEvent(hydrated, this.client),
        );
        return hydrated;
      }

      return await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          const relPersister = this.buildRelationPersister(client, repositoryFactory);

          // Phase 1: Save owning relations (ManyToOne, owning OneToOne) — sets FK on prepared
          await relPersister.saveOwning(prepared, "insert");

          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber(
            "beforeInsert",
            this.buildSubscriberEvent(prepared, client),
          );
          const hydrated = await executor.executeInsert(prepared);

          // Transfer relation data from prepared to hydrated (RETURNING * only has DB columns)
          this.transferRelations(prepared, hydrated);
          this.transferEmbeddedLists(prepared, hydrated);

          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber(
            "afterInsert",
            this.buildSubscriberEvent(hydrated, client),
          );

          // Phase 2: Save inverse relations (OneToMany, inverse OneToOne, ManyToMany)
          await relPersister.saveInverse(hydrated, "insert");

          // Phase 3: Save embedded list collection rows
          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        },
      );
    } catch (error) {
      const label = hookKind === "save" ? "save" : "insert";
      return wrapPgError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
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
    try {
      // Snapshot must be retrieved from the ORIGINAL entity BEFORE copy
      const snapshot = getSnapshot(entity);
      // Capture old entity for subscriber events (shallow copy so subscribers can diff)
      const oldEntity = snapshot ? { ...entity } : undefined;

      // Early exit: if snapshot exists, diff BEFORE copy/bump.
      // This avoids bumping version/timestamps when nothing changed.
      let changed: Dict | null = null;

      if (snapshot) {
        changed = diffColumns(entity, this.metadata, snapshot);

        if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
          // Nothing changed and no relations/embedded lists — skip entirely (no hooks, no DB write)
          return entity;
        }

        if (changed === null) {
          // No column changes but entity has relations or embedded lists — process relation/collection updates only.
          // No copy/bump: the main entity row is untouched.
          return await this.withImplicitTransaction(
            async ({ client, executor: _executor, repositoryFactory }) => {
              const relPersister = this.buildRelationPersister(client, repositoryFactory);
              await relPersister.saveOwning(entity, "update");
              await this.fireBeforeHook(hookKind, entity);
              await this.fireSubscriber("beforeUpdate", {
                ...this.buildSubscriberEvent(entity, client),
                oldEntity,
              });
              await relPersister.saveInverse(entity, "update");
              await this.saveAllEmbeddedLists(entity, client);
              await this.fireAfterHook(hookKind, entity);
              await this.fireSubscriber("afterUpdate", {
                ...this.buildSubscriberEvent(entity, client),
                oldEntity,
              });
              clearSnapshot(entity);
              return entity;
            },
          );
        }
      }

      // Something changed (or no snapshot) — copy, bump, validate
      const prepared = this.entityManager.update(entity);
      this.entityManager.validate(prepared);
      const updateEvent = {
        ...this.buildSubscriberEvent(prepared, this.client),
        oldEntity,
      };

      // Diff-based partial update (snapshot exists and changed is non-null)
      if (snapshot && changed) {
        const isJoinedChild =
          this.metadata.inheritance?.strategy === "joined" &&
          this.metadata.inheritance.discriminatorValue != null;

        // Fast path: no relations, no embedded lists, and not a joined child — skip transaction overhead.
        // Joined children require a transaction because they update two tables.
        if (!this.hasRelations && !this.hasEmbeddedLists && !isJoinedChild) {
          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber("beforeUpdate", updateEvent);
          const { text, params } = compilePartialUpdate(
            prepared,
            this.metadata,
            changed,
            this.namespace,
            this.amphora,
          );
          const result = await this.client.query(text, params);

          if (!result.rows[0]) {
            throw new ProteusRepositoryError(
              `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
              { debug: { entityName: this.metadata.entity.name } },
            );
          }

          const hydrated = hydrateReturning<E>(result.rows[0], this.metadata, {
            amphora: this.amphora,
          });
          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber("afterUpdate", {
            ...this.buildSubscriberEvent(hydrated, this.client),
            oldEntity,
          });
          return hydrated;
        }

        return await this.withImplicitTransaction(
          async ({ client, executor: _executor, repositoryFactory }) => {
            const relPersister = this.buildRelationPersister(client, repositoryFactory);
            await relPersister.saveOwning(prepared, "update");

            await this.fireBeforeHook(hookKind, prepared);
            await this.fireSubscriber("beforeUpdate", {
              ...this.buildSubscriberEvent(prepared, client),
              oldEntity,
            });

            // For joined inheritance children, compile a two-table partial update
            const joinedPartial = compileJoinedPartialUpdate(
              prepared,
              this.metadata,
              changed,
              this.namespace,
              this.amphora,
            );
            let hydrated: E;

            if (joinedPartial) {
              // Step 1: Execute root SQL (UPDATE or SELECT for root column values)
              const rootResult = await client.query(
                joinedPartial.rootSql.text,
                joinedPartial.rootSql.params,
              );

              if (joinedPartial.rootIsUpdate && !rootResult.rows[0]) {
                throw new ProteusRepositoryError(
                  `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
                  { debug: { entityName: this.metadata.entity.name } },
                );
              }

              const rootRow = rootResult.rows[0] ?? {};

              // Step 2: UPDATE child table (if any child columns changed)
              let childRow: Record<string, unknown> = {};
              if (joinedPartial.childSql) {
                const childResult = await client.query(
                  joinedPartial.childSql.text,
                  joinedPartial.childSql.params,
                );
                childRow = childResult.rows[0] ?? {};
              }

              // Merge both RETURNING/SELECT rows and hydrate
              const mergedRow = { ...rootRow, ...childRow };
              hydrated = hydrateReturning<E>(mergedRow, this.metadata, {
                amphora: this.amphora,
              });
            } else {
              // Single-table partial update (non-joined entities)
              const { text, params } = compilePartialUpdate(
                prepared,
                this.metadata,
                changed,
                this.namespace,
                this.amphora,
              );
              const result = await client.query(text, params);

              if (!result.rows[0]) {
                throw new ProteusRepositoryError(
                  `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
                  { debug: { entityName: this.metadata.entity.name } },
                );
              }

              hydrated = hydrateReturning<E>(result.rows[0], this.metadata, {
                amphora: this.amphora,
              });
            }

            this.transferRelations(prepared, hydrated);
            this.transferEmbeddedLists(prepared, hydrated);

            await this.fireAfterHook(hookKind, hydrated);
            await this.fireSubscriber("afterUpdate", {
              ...this.buildSubscriberEvent(hydrated, client),
              oldEntity,
            });

            await relPersister.saveInverse(hydrated, "update");
            await this.saveAllEmbeddedLists(hydrated, client);

            this.applyLazyRelations(hydrated, "single");
            return hydrated;
          },
        );
      }

      // No snapshot — full column update (fallback)
      if (!this.hasRelations && !this.hasEmbeddedLists) {
        await this.fireBeforeHook(hookKind, prepared);
        await this.fireSubscriber("beforeUpdate", updateEvent);
        const hydrated = await this.executor.executeUpdate(prepared);
        await this.fireAfterHook(hookKind, hydrated);
        await this.fireSubscriber("afterUpdate", {
          ...this.buildSubscriberEvent(hydrated, this.client),
          oldEntity,
        });
        return hydrated;
      }

      return await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          const relPersister = this.buildRelationPersister(client, repositoryFactory);

          // Phase 1: Save owning relations — sets FK on prepared
          await relPersister.saveOwning(prepared, "update");

          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber("beforeUpdate", {
            ...this.buildSubscriberEvent(prepared, client),
            oldEntity,
          });
          const hydrated = await executor.executeUpdate(prepared);

          // Transfer relation data from prepared to hydrated (RETURNING * only has DB columns)
          this.transferRelations(prepared, hydrated);
          this.transferEmbeddedLists(prepared, hydrated);

          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber("afterUpdate", {
            ...this.buildSubscriberEvent(hydrated, client),
            oldEntity,
          });

          // Phase 2: Save inverse relations
          await relPersister.saveInverse(hydrated, "update");

          // Phase 3: Save embedded list collection rows
          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        },
      );
    } catch (error) {
      const label = hookKind === "save" ? "save" : "update";
      return wrapPgError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  private async updateVersioned(
    entity: E,
    hookKind: "update" | "save" = "update",
  ): Promise<E> {
    // Diff check: if snapshot exists and nothing changed, skip entirely
    const snapshot = getSnapshot(entity);
    if (snapshot) {
      // Need a temporary copy to check for changes (don't bump version yet)
      const tempCopy = this.entityManager.copy(entity);
      const changed = diffColumns(tempCopy, this.metadata, snapshot);

      if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
        // Nothing changed and no relations/embedded lists — skip entirely (no hooks, no DB write)
        return entity;
      }

      if (changed === null) {
        // No column changes but entity has relations or embedded lists — process updates only.
        // No version bump: the main entity row is untouched.
        const oldEntity = { ...entity };
        return await this.withImplicitTransaction(
          async ({ client, repositoryFactory }) => {
            const txRelPersister = this.buildRelationPersister(client, repositoryFactory);
            await txRelPersister.saveOwning(entity, "update");
            await this.fireBeforeHook(hookKind, entity);
            await this.fireSubscriber("beforeUpdate", {
              ...this.buildSubscriberEvent(entity, client),
              oldEntity,
            });
            await txRelPersister.saveInverse(entity, "update");
            await this.saveAllEmbeddedLists(entity, client);
            await this.fireAfterHook(hookKind, entity);
            await this.fireSubscriber("afterUpdate", {
              ...this.buildSubscriberEvent(entity, client),
              oldEntity,
            });
            clearSnapshot(entity);
            return entity;
          },
        );
      }
    }

    const now = new Date();

    try {
      return await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          const partial = this.entityManager.versionUpdate(entity);

          // Override the versionEndDate with our shared timestamp (BF1)
          const versionEndDateField = this.metadata.fields.find(
            (f) => f.decorator === "VersionEndDate",
          );
          if (versionEndDateField) {
            (partial as any)[versionEndDateField.key] = now;
          }

          // Close the current version row (optimistic lock via VersionEndDate IS NULL)
          const pkPredicate = buildPrimaryKeyPredicate(entity, this.metadata);
          const versionEndDateGuardField = this.metadata.fields.find(
            (f) => f.decorator === "VersionEndDate",
          );
          const closeCriteria = versionEndDateGuardField
            ? { ...pkPredicate, [versionEndDateGuardField.key]: null }
            : pkPredicate;
          const rowCount = await executor.executeUpdateMany(
            closeCriteria as any,
            partial,
          );

          if (rowCount === 0) {
            throw new ProteusRepositoryError(
              `Optimistic lock conflict: "${this.metadata.entity.name}" version was modified concurrently`,
              { debug: { entityName: this.metadata.entity.name } },
            );
          }

          // Create the new version row
          const newVersion = this.entityManager.versionCopy(partial, entity);

          const versionStartDateField = this.metadata.fields.find(
            (f) => f.decorator === "VersionStartDate",
          );
          if (versionStartDateField) {
            (newVersion as any)[versionStartDateField.key] = now;
          }

          this.entityManager.validate(newVersion);

          // Phase 1: Save owning relations — sets FK on newVersion
          const txRelPersister = this.buildRelationPersister(client, repositoryFactory);
          await txRelPersister.saveOwning(newVersion, "update");

          // Intent-based hooks: developer called update() or save(), so fire those hooks
          const oldEntity = { ...entity };
          await this.fireBeforeHook(hookKind, newVersion);
          await this.fireSubscriber("beforeUpdate", {
            ...this.buildSubscriberEvent(newVersion, client),
            oldEntity,
          });
          const hydrated = await executor.executeInsert(newVersion);

          // Transfer relation data from newVersion to hydrated (RETURNING * only has DB columns)
          this.transferRelations(newVersion, hydrated);
          this.transferEmbeddedLists(newVersion, hydrated);

          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber("afterUpdate", {
            ...this.buildSubscriberEvent(hydrated, client),
            oldEntity,
          });

          // Phase 2: Save inverse relations
          await txRelPersister.saveInverse(hydrated, "update");

          // Phase 3: Save embedded list collection rows
          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");

          // Clear snapshot on original entity (prevent writes through now-closed version)
          clearSnapshot(entity);

          return hydrated;
        },
      );
    } catch (error) {
      const label = hookKind === "save" ? "save" : "update versioned";
      return wrapPgError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  protected async cloneOne(entity: E): Promise<E> {
    try {
      const cloned = await this.entityManager.clone(entity);
      this.entityManager.validate(cloned);

      // Fast path: no relations and no embedded lists — skip transaction overhead
      if (!this.hasRelations && !this.hasEmbeddedLists) {
        await this.entityManager.beforeInsert(cloned);
        await this.fireSubscriber(
          "beforeInsert",
          this.buildSubscriberEvent(cloned, this.client),
        );
        const hydrated = await this.executor.executeInsert(cloned);
        await this.entityManager.afterInsert(hydrated);
        await this.fireSubscriber(
          "afterInsert",
          this.buildSubscriberEvent(hydrated, this.client),
        );
        return hydrated;
      }

      return await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          const relPersister = this.buildRelationPersister(client, repositoryFactory);

          // Phase 1: Save owning relations
          await relPersister.saveOwning(cloned, "insert");

          await this.entityManager.beforeInsert(cloned);
          await this.fireSubscriber(
            "beforeInsert",
            this.buildSubscriberEvent(cloned, client),
          );
          const hydrated = await executor.executeInsert(cloned);

          // Transfer relation data from cloned to hydrated (RETURNING * only has DB columns)
          this.transferRelations(cloned, hydrated);
          this.transferEmbeddedLists(cloned, hydrated);

          await this.entityManager.afterInsert(hydrated);
          await this.fireSubscriber(
            "afterInsert",
            this.buildSubscriberEvent(hydrated, client),
          );

          // Phase 2: Save inverse relations
          await relPersister.saveInverse(hydrated, "insert");

          // Phase 3: Save embedded list collection rows
          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        },
      );
    } catch (error) {
      return wrapPgError(error, `Failed to clone "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  protected async destroyOne(entity: E): Promise<void> {
    return this.executeDestroy(entity, "executeDelete", "destroy");
  }

  protected async softDestroyOne(entity: E): Promise<void> {
    return this.executeSoftDestroyOne(entity);
  }

  // Dedicated soft destroy — fires BeforeSoftDestroy/AfterSoftDestroy, NOT hard destroy hooks
  private async executeSoftDestroyOne(entity: E): Promise<void> {
    try {
      // Fast path: no relations and no embedded lists — skip transaction overhead
      if (!this.hasRelations && !this.hasEmbeddedLists) {
        await this.entityManager.beforeSoftDestroy(entity);
        await this.fireSubscriber("beforeSoftDestroy", this.buildSubscriberEvent(entity));
        await this.executor.executeSoftDelete(
          buildPrimaryKeyPredicate(entity, this.metadata),
        );
        await this.entityManager.afterSoftDestroy(entity);
        await this.fireSubscriber("afterSoftDestroy", this.buildSubscriberEvent(entity));
        clearSnapshot(entity);
        return;
      }

      await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          await this.entityManager.beforeSoftDestroy(entity);
          await this.fireSubscriber(
            "beforeSoftDestroy",
            this.buildSubscriberEvent(entity, client),
          );

          await this.buildRelationPersister(client, repositoryFactory).destroy(
            entity,
            true,
          );

          // Collection table rows are intentionally preserved during soft-delete.
          // The parent row still exists (just flagged), so collection rows remain
          // correctly associated. This allows restore() to recover embedded list data.

          await executor.executeSoftDelete(
            buildPrimaryKeyPredicate(entity, this.metadata),
          );

          await this.entityManager.afterSoftDestroy(entity);
          await this.fireSubscriber(
            "afterSoftDestroy",
            this.buildSubscriberEvent(entity, client),
          );
        },
      );

      clearSnapshot(entity);
    } catch (error) {
      return wrapPgError(error, `Failed to soft destroy "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  private async executeDestroy(
    entity: E,
    method: "executeDelete" | "executeSoftDelete",
    label: string,
  ): Promise<void> {
    try {
      // Fast path: no relations — skip transaction overhead
      if (!this.hasRelations) {
        await this.entityManager.beforeDestroy(entity);
        await this.fireSubscriber("beforeDestroy", this.buildSubscriberEvent(entity));
        await this.executor[method](buildPrimaryKeyPredicate(entity, this.metadata));
        await this.entityManager.afterDestroy(entity);
        await this.fireSubscriber("afterDestroy", this.buildSubscriberEvent(entity));
        clearSnapshot(entity);
        return;
      }

      await this.withImplicitTransaction(
        async ({ client, executor, repositoryFactory }) => {
          await this.entityManager.beforeDestroy(entity);
          await this.fireSubscriber(
            "beforeDestroy",
            this.buildSubscriberEvent(entity, client),
          );

          await this.buildRelationPersister(client, repositoryFactory).destroy(entity);

          await executor[method](buildPrimaryKeyPredicate(entity, this.metadata));

          await this.entityManager.afterDestroy(entity);
          await this.fireSubscriber(
            "afterDestroy",
            this.buildSubscriberEvent(entity, client),
          );
        },
      );

      clearSnapshot(entity);
    } catch (error) {
      return wrapPgError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  /**
   * Upsert fires "insert" lifecycle hooks/subscribers by convention (TypeORM/Hibernate precedent).
   * Relations are cascaded identically to insertOne.
   */
  protected async upsertOne(entity: E, options?: UpsertOptions<E>): Promise<E> {
    try {
      const prepared = await this.entityManager.insert(entity);
      this.entityManager.validate(prepared);

      // Resolve property keys to column names for conflict columns
      const compileOptions: UpsertCompileOptions | undefined = options?.conflictOn
        ? {
            conflictColumns: (options.conflictOn as Array<string>).map((propKey) => {
              const field = this.metadata.fields.find((f) => f.key === propKey);
              return field?.name ?? propKey;
            }),
          }
        : undefined;

      // Fast path: no relations and no embedded lists — skip transaction overhead
      if (!this.hasRelations && !this.hasEmbeddedLists) {
        await this.fireBeforeHook("insert", prepared);
        await this.fireSubscriber(
          "beforeInsert",
          this.buildSubscriberEvent(prepared, this.client),
        );
        const { text, params } = compileUpsert(
          prepared,
          this.metadata,
          this.namespace,
          compileOptions,
          this.amphora,
        );
        const result = await this.client.query(text, params);
        const hydrated = hydrateReturning<E>(result.rows[0], this.metadata, {
          hooks: false,
          amphora: this.amphora,
        });
        await this.fireAfterHook("insert", hydrated);
        await this.fireSubscriber(
          "afterInsert",
          this.buildSubscriberEvent(hydrated, this.client),
        );
        return hydrated;
      }

      return await this.withImplicitTransaction(async ({ client, repositoryFactory }) => {
        const relPersister = this.buildRelationPersister(client, repositoryFactory);

        // Phase 1: Save owning relations — sets FK on prepared
        await relPersister.saveOwning(prepared, "insert");

        await this.fireBeforeHook("insert", prepared);
        await this.fireSubscriber(
          "beforeInsert",
          this.buildSubscriberEvent(prepared, client),
        );
        const { text, params } = compileUpsert(
          prepared,
          this.metadata,
          this.namespace,
          compileOptions,
          this.amphora,
        );
        const result = await client.query(text, params);
        const hydrated = hydrateReturning<E>(result.rows[0], this.metadata, {
          hooks: false,
          amphora: this.amphora,
        });

        // Transfer relation data from prepared to hydrated (RETURNING * only has DB columns)
        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);

        await this.fireAfterHook("insert", hydrated);
        await this.fireSubscriber(
          "afterInsert",
          this.buildSubscriberEvent(hydrated, client),
        );

        // Phase 2: Save inverse relations
        await relPersister.saveInverse(hydrated, "insert");

        // Phase 3: Save embedded list collection rows
        await this.saveAllEmbeddedLists(hydrated, client);

        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      });
    } catch (error) {
      return wrapPgError(error, `Failed to upsert "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  // ─── Abstract: aggregates ─────────────────────────────────────────

  protected async executeAggregate(
    type: AggregateFunction,
    field: keyof E,
    criteria?: Predicate<E>,
  ): Promise<number | null> {
    const pgType = PG_AGGREGATE_MAP[type];

    const state: QueryState<E> = {
      ...createEmptyState<E>(),
      predicates: criteria ? [{ predicate: criteria, conjunction: "and" }] : [],
    };

    const { text, params } = compileAggregate(
      pgType,
      field,
      state,
      this.metadata,
      this.namespace,
    );
    const result = await this.client.query<{ result: string | null }>(text, params);
    const raw = result.rows[0]?.result;
    return raw != null ? Number(raw) : null;
  }

  // ─── Abstract: buildLazyLoader / isDuplicateKeyError ──────────────

  protected buildLazyLoader(): LazyRelationLoader {
    return async (entity: IEntity, relation: MetaRelation) => {
      if (relation.type === "ManyToMany") {
        return this.loadManyToManyLazy(entity, relation);
      }

      const foreignTarget = relation.foreignConstructor();
      const repo = this.repositoryFactory(foreignTarget);
      const filter = buildRelationFilter(relation, entity);
      const isCol = relation.type === "OneToMany";
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return isCol ? repo.find(filter, orderOpts) : repo.findOne(filter);
    };
  }

  protected isDuplicateKeyError(error: unknown): boolean {
    return error instanceof DuplicateKeyError;
  }

  // ─── Private: PG-specific helpers ─────────────────────────────────

  private buildCursorQueryState(options?: CursorOptions<E>): QueryState<E> {
    return {
      ...createEmptyState<E>(),
      predicates: options?.where
        ? [{ predicate: options.where, conjunction: "and" }]
        : [],
      orderBy: options?.orderBy ?? null,
      selections: options?.select ?? null,
      withDeleted: options?.withDeleted ?? false,
      versionTimestamp: options?.versionTimestamp ?? null,
    };
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

    if (!owningJoinKeys || !foreignJoinKeys) {
      // Unidirectional M2M with no join keys on either side — cannot resolve
      this.logger.debug(
        "loadManyToManyLazy: cannot resolve join keys for unidirectional M2M",
        {
          relation: relation.key,
          foreignKey: relation.foreignKey,
          entity: this.metadata.entity.name,
        },
      );
      return [];
    }

    // When relation.joinKeys is null (inverse side), we need to swap:
    // use findKeys for WHERE (they map our PK to join columns) and
    // owning side's joinKeys for SELECT (they map foreign PK to join columns)
    const whereJoinKeys = relation.joinKeys ?? relation.findKeys!;
    const selectJoinKeys = relation.joinKeys ? foreignJoinKeys : owningJoinKeys;

    const joinTableName = relation.joinTable as string;
    const schema = this.metadata.entity.namespace ?? this.namespace;
    const qualifiedTable = schema
      ? `"${schema}"."${joinTableName}"`
      : `"${joinTableName}"`;

    // Build WHERE from this entity's PK
    const params: Array<unknown> = [];
    const conditions: Array<string> = [];

    for (const [joinCol, localPk] of Object.entries(whereJoinKeys)) {
      params.push((entity as any)[localPk]);
      conditions.push(`"${joinCol}" = $${params.length}`);
    }

    // Select the foreign entity's join columns
    const foreignJoinCols = Object.keys(selectJoinKeys);
    const selectCols = foreignJoinCols.map((c) => `"${c}"`).join(", ");

    const sql = `SELECT ${selectCols} FROM ${qualifiedTable} WHERE ${conditions.join(" AND ")}`;
    const result = await this.client.query(sql, params);

    if (result.rows.length === 0) return [];

    // Find foreign entities by their PKs
    const foreignPkKeys = Object.values(selectJoinKeys);
    const repo = this.repositoryFactory(foreignTarget);

    if (foreignPkKeys.length === 1) {
      const pkKey = foreignPkKeys[0];
      const joinCol = foreignJoinCols[0];
      const pks = result.rows.map((r: any) => r[joinCol]);
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return repo.find({ [pkKey]: { $in: pks } }, orderOpts);
    }

    // Composite PK fallback
    const entities: Array<IEntity> = [];
    for (const row of result.rows) {
      const filter: Record<string, unknown> = {};
      for (let i = 0; i < foreignPkKeys.length; i++) {
        filter[foreignPkKeys[i]] = (row as any)[foreignJoinCols[i]];
      }
      const found = await repo.findOne(filter);
      if (found) entities.push(found);
    }
    return entities;
  }

  private buildRelationPersister(
    clientOverride?: PostgresQueryClient,
    repositoryFactoryOverride?: RepositoryFactory,
  ): RelationPersister {
    return new RelationPersister({
      metadata: this.metadata,
      namespace: this.namespace,
      parent: this.parent,
      repositoryFactory: repositoryFactoryOverride ?? this.repositoryFactory,
      joinTableOps: createPostgresJoinTableOps(clientOverride ?? this.client),
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

  private async saveAllEmbeddedLists(
    entity: E,
    client: PostgresQueryClient,
  ): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      await saveEmbeddedListRows(entity, el, client, this.embeddedListNamespace);
    }
  }

  private async loadAllEmbeddedLists(
    entities: Array<E>,
    client: PostgresQueryClient,
    scope: QueryScope,
  ): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      if (el.loading[scope] === "lazy") continue;
      await loadEmbeddedListRowsBatch(entities, el, client, this.embeddedListNamespace);
    }
  }

  protected override async loadEmbeddedListForEntity(
    entity: E,
    embeddedList: MetaEmbeddedList,
  ): Promise<void> {
    await loadEmbeddedListRows(
      entity,
      embeddedList,
      this.client,
      this.embeddedListNamespace,
    );
  }
}
