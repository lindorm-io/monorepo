import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, DeepPartial, Dict, Predicate } from "@lindorm/types";
import { ProteusRepositoryError } from "../../../../errors/ProteusRepositoryError";
import type {
  IEntity,
  IProteusCursor,
  IProteusQueryBuilder,
} from "../../../../interfaces";
import type {
  ClearOptions,
  CursorOptions,
  DeleteOptions,
  FindOptions,
  UpsertOptions,
} from "../../../../types";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type { MetaRelation, QueryScope } from "../../../entity/types/metadata";
import type { QueryState } from "../../../types/query";
import type { RepositoryFactory } from "../../../types/repository-factory";
import type { AggregateFunction } from "../../../types/aggregate";
import type { MysqlQueryClient } from "../types/mysql-query-client";
import { DriverRepositoryBase } from "../../../classes/DriverRepositoryBase";
import { createEmptyState } from "../../../../classes/QueryBuilder";
import { compileAggregate } from "../utils/query/compile-aggregate";
import type { AggregateType } from "../utils/query/compile-aggregate";
import { compileUpsert } from "../utils/query/compile-upsert";
import { compileQuery } from "../utils/query/compile-query";
import {
  compileJoinedPartialUpdate,
  compilePartialUpdate,
} from "../utils/query/compile-partial-update";
import { compileSelectByPk } from "../utils/query/compile-select-by-pk";
import { hydrateReturning } from "../utils/query/hydrate-returning";
import { buildPrimaryKeyPredicate } from "../../../utils/repository/build-pk-predicate";
import {
  guardAppendOnly,
  guardDeleteDateField,
  guardVersionFields,
  validateRelationNames,
} from "../../../utils/repository/repository-guards";
import { wrapMysqlError } from "../utils/repository/wrap-mysql-error";
import { RelationPersister } from "../../../utils/repository/RelationPersister";
import { createMysqlJoinTableOps } from "../utils/repository/mysql-join-table-ops";
import type { LazyRelationLoader } from "../../../entity/utils/install-lazy-relations";
import type { EntityEmitFn } from "../../../../types/event-map";
import { buildRelationFilter } from "../../../utils/repository/build-relation-filter";
import { quoteIdentifier, quoteQualifiedName } from "../utils/quote-identifier";
import { getJoinName } from "../../../entity/utils/get-join-name";
import { DuplicateKeyError } from "../../../errors/DuplicateKeyError";
import { MySqlCursor } from "./MySqlCursor";
import { getSnapshot, clearSnapshot } from "../../../entity/utils/snapshot-store";
import { diffColumns } from "../../../entity/utils/diff-columns";
import { filterHiddenSelections } from "../../../utils/query/filter-hidden-selections";
import { loadRelationIds } from "../utils/repository/load-relation-ids";
import { loadRelationCounts } from "../utils/repository/load-relation-counts";
import {
  saveEmbeddedListRows,
  loadEmbeddedListRows,
  loadEmbeddedListRowsBatch,
} from "../utils/repository/embedded-list-ops";
import type { MetaEmbeddedList } from "../../../entity/types/metadata";

export type { RepositoryFactory } from "../../../types/repository-factory";

export type WithImplicitTransaction<E extends IEntity> = <T>(
  fn: (ctx: {
    client: MysqlQueryClient;
    executor: IRepositoryExecutor<E>;
    repositoryFactory: RepositoryFactory;
  }) => Promise<T>,
) => Promise<T>;

export type MySqlRepositoryOptions<E extends IEntity> = {
  target: Constructor<E>;
  executor: IRepositoryExecutor<E>;
  queryBuilderFactory: () => IProteusQueryBuilder<E>;
  client: MysqlQueryClient;
  namespace: string | null;
  logger: ILogger;
  context?: unknown;
  parent?: Constructor<IEntity>;
  repositoryFactory: RepositoryFactory;
  withImplicitTransaction: WithImplicitTransaction<E>;
  emitEntity?: EntityEmitFn;
  amphora?: IAmphora;
};

const MYSQL_AGGREGATE_MAP: Record<AggregateFunction, AggregateType> = {
  sum: "SUM",
  avg: "AVG",
  min: "MIN",
  max: "MAX",
};

export class MySqlRepository<
  E extends IEntity,
  O extends DeepPartial<E> = DeepPartial<E>,
> extends DriverRepositoryBase<E, O> {
  private readonly client: MysqlQueryClient;
  private readonly withImplicitTransaction: WithImplicitTransaction<E>;
  private readonly hasEmbeddedLists: boolean;
  private readonly amphora: IAmphora | undefined;

  public constructor(options: MySqlRepositoryOptions<E>) {
    super({
      target: options.target,
      executor: options.executor,
      queryBuilderFactory: options.queryBuilderFactory,
      namespace: options.namespace,
      logger: options.logger,
      driver: "mysql",
      driverLabel: "MySqlRepository",
      context: options.context,
      parent: options.parent,
      repositoryFactory: options.repositoryFactory,
      emitEntity: options.emitEntity,
    });

    this.client = options.client;
    this.withImplicitTransaction = options.withImplicitTransaction;
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
      if (this.hasAsyncRelationIds) await loadRelationIds(entities, loadCtx);
      if (this.hasRelationCounts) await loadRelationCounts(entities, loadCtx);
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
      if (this.hasAsyncRelationIds) await loadRelationIds(entities, loadCtx);
      if (this.hasRelationCounts) await loadRelationCounts(entities, loadCtx);
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

  // ─── Override: MySQL error wrapping ──────────────────────────────

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
      return wrapMysqlError(error, `Failed to delete "${this.metadata.entity.name}"`, {
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
      return wrapMysqlError(
        error,
        `Failed to updateMany "${this.metadata.entity.name}"`,
        { criteria },
      );
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
      return wrapMysqlError(
        error,
        `Failed to softDelete "${this.metadata.entity.name}"`,
        { criteria },
      );
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
      return wrapMysqlError(error, `Failed to restore "${this.metadata.entity.name}"`, {
        criteria,
      });
    }
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

    const state = this.buildCursorQueryState(effectiveOptions);
    const { text, params, aliasMap } = compileQuery(state, this.metadata, this.namespace);

    return new MySqlCursor<E>({
      sql: text,
      params,
      metadata: this.metadata,
      aliasMap,
      client: this.client,
      batchSize: options?.batchSize ?? 100,
      namespace: this.namespace,
    });
  }

  public async clear(_options?: ClearOptions): Promise<void> {
    guardAppendOnly(this.metadata, "clear");

    // For inheritance children, always use the ROOT entity's table.
    const isInheritanceChild = this.metadata.inheritance?.discriminatorValue != null;
    const rootEntityName = isInheritanceChild
      ? getEntityMetadata(this.metadata.inheritance!.root).entity.name
      : this.metadata.entity.name;
    const tableName = quoteQualifiedName(this.namespace, rootEntityName);

    // For inheritance children (single-table or joined), issue a discriminator-scoped DELETE
    if (isInheritanceChild) {
      const discField = this.metadata.fields.find(
        (f) => f.key === this.metadata.inheritance!.discriminatorField,
      );
      await this.client.query(
        `DELETE FROM ${tableName} WHERE ${quoteIdentifier(discField!.name)} = ?`,
        [this.metadata.inheritance!.discriminatorValue],
      );
      return;
    }

    // MySQL TRUNCATE TABLE resets AUTO_INCREMENT and is faster than DELETE
    if (_options?.restartIdentity) {
      await this.client.query(`TRUNCATE TABLE ${tableName}`);
    } else {
      await this.client.query(`DELETE FROM ${tableName}`);
    }
  }

  // ─── Abstract: single-entity operations ───────────────────────────

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

      const isJoinedChild =
        this.metadata.inheritance?.strategy === "joined" &&
        this.metadata.inheritance.discriminatorValue != null;

      if (isJoinedChild) {
        return await this.withImplicitTransaction(async () => {
          const results: Array<E> = [];
          for (const entity of prepared) {
            results.push(await this.insertOne(entity));
          }
          return results;
        });
      }

      if (!this.hasEmbeddedLists) {
        const results = await this.executor.executeInsertBulk(prepared);
        for (const entity of results) {
          this.applyLazyRelations(entity, "single");
        }
        return results;
      }

      return await this.withImplicitTransaction(async ({ client, executor }) => {
        const results = await executor.executeInsertBulk(prepared);

        for (let i = 0; i < results.length; i++) {
          this.transferEmbeddedLists(prepared[i], results[i]);
          await this.saveAllEmbeddedLists(results[i], client);
        }

        for (const entity of results) {
          this.applyLazyRelations(entity, "single");
        }

        return results;
      });
    } catch (error) {
      return wrapMysqlError(
        error,
        `Failed to bulk insert "${this.metadata.entity.name}"`,
        {
          entityName: this.metadata.entity.name,
        },
      );
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

          await relPersister.saveOwning(prepared, "insert");

          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber(
            "beforeInsert",
            this.buildSubscriberEvent(prepared, client),
          );
          const hydrated = await executor.executeInsert(prepared);

          this.transferRelations(prepared, hydrated);
          this.transferEmbeddedLists(prepared, hydrated);

          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber(
            "afterInsert",
            this.buildSubscriberEvent(hydrated, client),
          );

          await relPersister.saveInverse(hydrated, "insert");

          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        },
      );
    } catch (error) {
      const label = hookKind === "save" ? "save" : "insert";
      return wrapMysqlError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
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
      const snapshot = getSnapshot(entity);
      const oldEntity = snapshot ? { ...entity } : undefined;

      let changed: Dict | null = null;

      if (snapshot) {
        changed = diffColumns(entity, this.metadata, snapshot);

        if (changed === null && !this.hasRelations && !this.hasEmbeddedLists) {
          return entity;
        }

        if (changed === null) {
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

      const prepared = this.entityManager.update(entity);
      this.entityManager.validate(prepared);
      const updateEvent = {
        ...this.buildSubscriberEvent(prepared, this.client),
        oldEntity,
      };

      if (snapshot && changed) {
        const isJoinedChild =
          this.metadata.inheritance?.strategy === "joined" &&
          this.metadata.inheritance.discriminatorValue != null;

        if (!this.hasRelations && !this.hasEmbeddedLists && !isJoinedChild) {
          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber("beforeUpdate", updateEvent);

          const hydrated = await this.withImplicitTransaction(async ({ client }) => {
            const { text, params } = compilePartialUpdate(
              prepared,
              this.metadata,
              changed,
              this.namespace,
              this.amphora,
            );
            const result = await client.query(text, params);

            if (result.rowCount === 0) {
              throw new ProteusRepositoryError(
                `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
                { debug: { entityName: this.metadata.entity.name } },
              );
            }

            // SELECT-back the updated row
            const selectSql = compileSelectByPk(prepared, this.metadata, this.namespace);
            const { rows } = await client.query(selectSql.text, selectSql.params);
            return hydrateReturning<E>(rows[0], this.metadata, { amphora: this.amphora });
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

            const joinedPartial = compileJoinedPartialUpdate(
              prepared,
              this.metadata,
              changed,
              this.namespace,
              this.amphora,
            );
            let hydrated: E;

            if (joinedPartial) {
              // Root UPDATE or SELECT
              const rootResult = await client.query(
                joinedPartial.rootSql.text,
                joinedPartial.rootSql.params,
              );

              if (joinedPartial.rootIsUpdate && rootResult.rowCount === 0) {
                throw new ProteusRepositoryError(
                  `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
                  { debug: { entityName: this.metadata.entity.name } },
                );
              }

              // Child UPDATE or SELECT
              if (joinedPartial.childSql) {
                await client.query(
                  joinedPartial.childSql.text,
                  joinedPartial.childSql.params,
                );
              }

              // SELECT-back the full entity
              const selectSql = compileSelectByPk(
                prepared,
                this.metadata,
                this.namespace,
              );
              const { rows } = await client.query(selectSql.text, selectSql.params);
              hydrated = hydrateReturning<E>(rows[0], this.metadata, {
                amphora: this.amphora,
              });
            } else {
              const { text, params } = compilePartialUpdate(
                prepared,
                this.metadata,
                changed,
                this.namespace,
                this.amphora,
              );
              const result = await client.query(text, params);

              if (result.rowCount === 0) {
                throw new ProteusRepositoryError(
                  `Optimistic lock conflict: "${this.metadata.entity.name}" was modified concurrently`,
                  { debug: { entityName: this.metadata.entity.name } },
                );
              }

              const selectSql = compileSelectByPk(
                prepared,
                this.metadata,
                this.namespace,
              );
              const { rows } = await client.query(selectSql.text, selectSql.params);
              hydrated = hydrateReturning<E>(rows[0], this.metadata, {
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

          await relPersister.saveOwning(prepared, "update");

          await this.fireBeforeHook(hookKind, prepared);
          await this.fireSubscriber("beforeUpdate", {
            ...this.buildSubscriberEvent(prepared, client),
            oldEntity,
          });
          const hydrated = await executor.executeUpdate(prepared);

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
    } catch (error) {
      const label = hookKind === "save" ? "save" : "update";
      return wrapMysqlError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
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

          const versionEndDateField = this.metadata.fields.find(
            (f) => f.decorator === "VersionEndDate",
          );
          if (versionEndDateField) {
            (partial as any)[versionEndDateField.key] = now;
          }

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

          const newVersion = this.entityManager.versionCopy(partial, entity);

          const versionStartDateField = this.metadata.fields.find(
            (f) => f.decorator === "VersionStartDate",
          );
          if (versionStartDateField) {
            (newVersion as any)[versionStartDateField.key] = now;
          }

          this.entityManager.validate(newVersion);

          const txRelPersister = this.buildRelationPersister(client, repositoryFactory);
          await txRelPersister.saveOwning(newVersion, "update");

          const oldEntity = { ...entity };
          await this.fireBeforeHook(hookKind, newVersion);
          await this.fireSubscriber("beforeUpdate", {
            ...this.buildSubscriberEvent(newVersion, client),
            oldEntity,
          });
          const hydrated = await executor.executeInsert(newVersion);

          this.transferRelations(newVersion, hydrated);
          this.transferEmbeddedLists(newVersion, hydrated);

          await this.fireAfterHook(hookKind, hydrated);
          await this.fireSubscriber("afterUpdate", {
            ...this.buildSubscriberEvent(hydrated, client),
            oldEntity,
          });

          await txRelPersister.saveInverse(hydrated, "update");

          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");

          clearSnapshot(entity);

          return hydrated;
        },
      );
    } catch (error) {
      const label = hookKind === "save" ? "save" : "update versioned";
      return wrapMysqlError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  protected async cloneOne(entity: E): Promise<E> {
    try {
      const cloned = await this.entityManager.clone(entity);
      this.entityManager.validate(cloned);

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

          await relPersister.saveOwning(cloned, "insert");

          await this.entityManager.beforeInsert(cloned);
          await this.fireSubscriber(
            "beforeInsert",
            this.buildSubscriberEvent(cloned, client),
          );
          const hydrated = await executor.executeInsert(cloned);

          this.transferRelations(cloned, hydrated);
          this.transferEmbeddedLists(cloned, hydrated);

          await this.entityManager.afterInsert(hydrated);
          await this.fireSubscriber(
            "afterInsert",
            this.buildSubscriberEvent(hydrated, client),
          );

          await relPersister.saveInverse(hydrated, "insert");

          await this.saveAllEmbeddedLists(hydrated, client);

          this.applyLazyRelations(hydrated, "single");
          return hydrated;
        },
      );
    } catch (error) {
      return wrapMysqlError(error, `Failed to clone "${this.metadata.entity.name}"`, {
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

  private async executeSoftDestroyOne(entity: E): Promise<void> {
    try {
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
      return wrapMysqlError(
        error,
        `Failed to soft destroy "${this.metadata.entity.name}"`,
        {
          entityName: this.metadata.entity.name,
        },
      );
    }
  }

  private async executeDestroy(
    entity: E,
    method: "executeDelete" | "executeSoftDelete",
    label: string,
  ): Promise<void> {
    try {
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
      return wrapMysqlError(error, `Failed to ${label} "${this.metadata.entity.name}"`, {
        entityName: this.metadata.entity.name,
      });
    }
  }

  protected async upsertOne(entity: E, _options?: UpsertOptions<E>): Promise<E> {
    try {
      const prepared = await this.entityManager.insert(entity);
      this.entityManager.validate(prepared);

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
          this.amphora,
        );
        await this.client.query(text, params);
        // SELECT-back the upserted row
        const selectSql = compileSelectByPk(prepared, this.metadata, this.namespace);
        const { rows } = await this.client.query(selectSql.text, selectSql.params);
        const hydrated = hydrateReturning<E>(rows[0], this.metadata, {
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
          this.amphora,
        );
        await client.query(text, params);
        // SELECT-back the upserted row
        const selectSql = compileSelectByPk(prepared, this.metadata, this.namespace);
        const { rows } = await client.query(selectSql.text, selectSql.params);
        const hydrated = hydrateReturning<E>(rows[0], this.metadata, {
          hooks: false,
          amphora: this.amphora,
        });

        this.transferRelations(prepared, hydrated);
        this.transferEmbeddedLists(prepared, hydrated);

        await this.fireAfterHook("insert", hydrated);
        await this.fireSubscriber(
          "afterInsert",
          this.buildSubscriberEvent(hydrated, client),
        );

        await relPersister.saveInverse(hydrated, "insert");

        await this.saveAllEmbeddedLists(hydrated, client);

        this.applyLazyRelations(hydrated, "single");
        return hydrated;
      });
    } catch (error) {
      return wrapMysqlError(error, `Failed to upsert "${this.metadata.entity.name}"`, {
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
    const mysqlType = MYSQL_AGGREGATE_MAP[type];

    const state: QueryState<E> = {
      ...createEmptyState<E>(),
      predicates: criteria ? [{ predicate: criteria, conjunction: "and" }] : [],
    };

    const { text, params } = compileAggregate(
      mysqlType,
      field,
      state,
      this.metadata,
      this.namespace,
    );
    const { rows } = await this.client.query(text, params);
    const raw = (rows[0] as any)?.result;
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

  // ─── Private: MySQL-specific helpers ─────────────────────────────

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

    const owningJoinKeys = relation.joinKeys ?? inverseRelation?.joinKeys;
    const foreignJoinKeys = inverseRelation?.joinKeys ?? relation.joinKeys;

    if (!owningJoinKeys || !foreignJoinKeys) {
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

    const whereJoinKeys = relation.joinKeys ?? relation.findKeys!;
    const selectJoinKeys = relation.joinKeys ? foreignJoinKeys : owningJoinKeys;

    const joinTableName = relation.joinTable as string;
    const resolvedJoinName = getJoinName(joinTableName, { namespace: this.namespace });
    const qualifiedTable = quoteQualifiedName(this.namespace, resolvedJoinName.name);

    const params: Array<unknown> = [];
    const conditions: Array<string> = [];

    for (const [joinCol, localPk] of Object.entries(whereJoinKeys)) {
      params.push((entity as any)[localPk]);
      conditions.push(`${quoteIdentifier(joinCol)} = ?`);
    }

    const foreignJoinCols = Object.keys(selectJoinKeys);
    const selectCols = foreignJoinCols.map((c) => quoteIdentifier(c)).join(", ");

    const sql = `SELECT ${selectCols} FROM ${qualifiedTable} WHERE ${conditions.join(" AND ")}`;
    const { rows } = await this.client.query(sql, params);

    if (rows.length === 0) return [];

    const foreignPkKeys = Object.values(selectJoinKeys);
    const repo = this.repositoryFactory(foreignTarget);

    if (foreignPkKeys.length === 1) {
      const pkKey = foreignPkKeys[0];
      const joinCol = foreignJoinCols[0];
      const pks = rows.map((r: any) => r[joinCol]);
      const orderOpts = relation.orderBy ? { order: relation.orderBy } : undefined;
      return repo.find({ [pkKey]: { $in: pks } }, orderOpts);
    }

    const entities: Array<IEntity> = [];
    for (const row of rows) {
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
    clientOverride?: MysqlQueryClient,
    repositoryFactoryOverride?: RepositoryFactory,
  ): RelationPersister {
    return new RelationPersister({
      metadata: this.metadata,
      namespace: this.namespace,
      parent: this.parent,
      repositoryFactory: repositoryFactoryOverride ?? this.repositoryFactory,
      joinTableOps: createMysqlJoinTableOps(clientOverride ?? this.client),
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

  private async saveAllEmbeddedLists(entity: E, client: MysqlQueryClient): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      await saveEmbeddedListRows(entity, el, client, this.namespace);
    }
  }

  private async loadAllEmbeddedLists(
    entities: Array<E>,
    client: MysqlQueryClient,
    scope: QueryScope,
  ): Promise<void> {
    if (!this.hasEmbeddedLists) return;
    for (const el of this.metadata.embeddedLists) {
      if (el.loading[scope] === "lazy") continue;
      await loadEmbeddedListRowsBatch(entities, el, client, this.namespace);
    }
  }

  protected override async loadEmbeddedListForEntity(
    entity: E,
    embeddedList: MetaEmbeddedList,
  ): Promise<void> {
    await loadEmbeddedListRows(entity, embeddedList, this.client, this.namespace);
  }
}
