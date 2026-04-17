import type { IAmphora } from "@lindorm/amphora";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
} from "../../../../interfaces";
import type {
  FilterRegistryGetter,
  IProteusDriver,
  MetadataResolver,
  TransactionHandle,
} from "../../../interfaces/ProteusDriver";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type {
  ProteusMemoryOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types";
import type { EntityEmitFn } from "../../../../types/event-map";
import type { RepositoryFactory } from "../../../types/repository-factory";
import type { FilterRegistry } from "../../../utils/query/filter-registry";
import type {
  MemoryStore,
  MemoryTable,
  MemoryTransactionHandle,
} from "../types/memory-store";
import { getEntityName } from "../../../entity/utils/get-entity-name";
import { getJoinName } from "../../../entity/utils/get-join-name";
import { resolveInheritanceRoot } from "../../../entity/utils/resolve-inheritance-root";
import { MemoryDriverError } from "../errors/MemoryDriverError";
import { MemoryExecutor } from "./MemoryExecutor";
import { MemoryRepository, type WithImplicitTransaction } from "./MemoryRepository";
import { MemoryQueryBuilder } from "./MemoryQueryBuilder";
import { MemoryTransactionContext } from "./MemoryTransactionContext";

const createEmptyStore = (): MemoryStore => ({
  tables: new Map(),
  joinTables: new Map(),
  collectionTables: new Map(),
  incrementCounters: new Map(),
});

const cloneStore = (store: MemoryStore): MemoryStore => ({
  tables: new Map(
    [...store.tables].map(([k, t]) => [
      k,
      new Map([...t].map(([pk, row]) => [pk, structuredClone(row)])),
    ]),
  ),
  joinTables: new Map(
    [...store.joinTables].map(([k, t]) => [
      k,
      new Map([...t].map(([pk, row]) => [pk, structuredClone(row)])),
    ]),
  ),
  collectionTables: new Map(
    [...store.collectionTables].map(([k, ct]) => [
      k,
      new Map([...ct].map(([fk, rows]) => [fk, structuredClone(rows)])),
    ]),
  ),
  incrementCounters: new Map(store.incrementCounters),
});

const resolveTableKey = (namespace: string | null, name: string): string =>
  namespace ? `${namespace}.${name}` : name;

export class MemoryDriver implements IProteusDriver {
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly emitEntity: EntityEmitFn;
  private readonly amphora: IAmphora | undefined;
  private store: MemoryStore;

  public constructor(
    _options: ProteusMemoryOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    emitEntity?: EntityEmitFn,
    amphora?: IAmphora,
  ) {
    this.logger = logger.child(["MemoryDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? ((): FilterRegistry => new Map());
    this.emitEntity = emitEntity ?? (async (): Promise<void> => {});
    this.amphora = amphora;
    this.store = createEmptyStore();
  }

  public async connect(): Promise<void> {
    this.logger.debug("Memory driver connected");
  }

  public async ping(): Promise<boolean> {
    return true;
  }

  public async disconnect(): Promise<void> {
    this.store.tables.clear();
    this.store.joinTables.clear();
    this.store.collectionTables.clear();
    this.store.incrementCounters.clear();
    this.logger.debug("Memory driver disconnected");
  }

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    for (const target of entities) {
      const metadata = this.resolveMetadata(target);
      const rootTarget = resolveInheritanceRoot(target, metadata);
      const entityName = getEntityName(rootTarget, { namespace: this.namespace });
      const tableKey = resolveTableKey(entityName.namespace, entityName.name);

      if (!this.store.tables.has(tableKey)) {
        this.store.tables.set(tableKey, new Map());
      }

      // Create join tables for ManyToMany relations
      for (const relation of metadata.relations) {
        if (relation.type !== "ManyToMany" || !relation.joinTable) continue;

        const joinName = getJoinName(relation.joinTable as string, {
          namespace: this.namespace,
        });
        const joinKey = resolveTableKey(joinName.namespace, joinName.name);

        if (!this.store.joinTables.has(joinKey)) {
          this.store.joinTables.set(joinKey, new Map());
        }
      }

      // Create collection tables for @EmbeddedList
      for (const el of metadata.embeddedLists ?? []) {
        const collKey = resolveTableKey(entityName.namespace, el.tableName);

        if (!this.store.collectionTables.has(collKey)) {
          this.store.collectionTables.set(collKey, new Map());
        }
      }
    }

    this.logger.debug("Memory driver setup complete", {
      tables: this.store.tables.size,
      joinTables: this.store.joinTables.size,
      collectionTables: this.store.collectionTables.size,
    });
  }

  public getStore(): MemoryStore {
    return this.store;
  }

  public getTableKey<E extends IEntity>(target: Constructor<E>): string {
    const metadata = this.resolveMetadata(target);
    const rootTarget = resolveInheritanceRoot(target, metadata);
    const entityName = getEntityName(rootTarget, { namespace: this.namespace });
    return resolveTableKey(entityName.namespace, entityName.name);
  }

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    const store = this.store;
    const namespace = this.namespace;

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, context);

    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) => {
      const snapshot = cloneStore(store);
      try {
        const txExecutor = this.createExecutorForStore(target, store);
        const result = await fn({
          executor: txExecutor,
          repositoryFactory: factory,
          store,
        });
        return result;
      } catch (error) {
        // Restore store on failure
        store.tables = snapshot.tables;
        store.joinTables = snapshot.joinTables;
        store.collectionTables = snapshot.collectionTables;
        store.incrementCounters = snapshot.incrementCounters;
        throw error;
      }
    };

    return new MemoryRepository<E>({
      target,
      executor: this.createExecutor(target),
      queryBuilderFactory: () => this.createQueryBuilder(target),
      store,
      namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      withImplicitTransaction,
      emitEntity: this.emitEntity,
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    const txHandle = handle as MemoryTransactionHandle;
    const namespace = this.namespace;

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p, context);

    // Already in transaction — no-op for implicit transactions
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) => {
      const txExecutor = this.createExecutorForStore(target, txHandle.store);
      return fn({
        executor: txExecutor,
        repositoryFactory: factory,
        store: txHandle.store,
      });
    };

    return new MemoryRepository<E>({
      target,
      executor: this.createExecutorForStore(target, txHandle.store),
      queryBuilderFactory: () => this.createTransactionalQueryBuilder(target, handle),
      store: txHandle.store,
      namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      withImplicitTransaction,
      emitEntity: this.emitEntity,
    });
  }

  public createExecutor<E extends IEntity>(
    target: Constructor<E>,
  ): IRepositoryExecutor<E> {
    return this.createExecutorForStore(target, this.store);
  }

  public createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IRepositoryExecutor<E> {
    const txHandle = handle as MemoryTransactionHandle;
    return this.createExecutorForStore(target, txHandle.store);
  }

  public createQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);
    const tableKey = this.getTableKey(target);
    const store = this.store;

    return new MemoryQueryBuilder<E>(
      metadata,
      (): MemoryTable =>
        store.tables.get(tableKey) ??
        ((): MemoryTable => {
          const t: MemoryTable = new Map();
          store.tables.set(tableKey, t);
          return t;
        })(),
      (): MemoryStore => store,
      this.namespace,
      this.logger,
      this.amphora,
    );
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);
    const tableKey = this.getTableKey(target);
    const txHandle = handle as MemoryTransactionHandle;

    return new MemoryQueryBuilder<E>(
      metadata,
      (): MemoryTable =>
        txHandle.store.tables.get(tableKey) ??
        ((): MemoryTable => {
          const t: MemoryTable = new Map();
          txHandle.store.tables.set(tableKey, t);
          return t;
        })(),
      (): MemoryStore => txHandle.store,
      this.namespace,
      this.logger,
      this.amphora,
    );
  }

  public async acquireClient(): Promise<never> {
    throw new MemoryDriverError("Memory driver does not expose a client");
  }

  public async beginTransaction(
    _options?: TransactionOptions,
  ): Promise<TransactionHandle> {
    const handle: MemoryTransactionHandle = {
      store: cloneStore(this.store),
      state: "active",
      savepointStack: [],
    };
    return handle;
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as MemoryTransactionHandle;
    if (txHandle.state !== "active") {
      throw new MemoryDriverError(`Cannot commit: transaction is ${txHandle.state}`);
    }

    // Replace main store maps with transaction's working copy
    this.store.tables = txHandle.store.tables;
    this.store.joinTables = txHandle.store.joinTables;
    this.store.collectionTables = txHandle.store.collectionTables;
    this.store.incrementCounters = txHandle.store.incrementCounters;
    txHandle.state = "committed";
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as MemoryTransactionHandle;
    if (txHandle.state !== "active") {
      throw new MemoryDriverError(`Cannot rollback: transaction is ${txHandle.state}`);
    }

    // Discard working copy — main store untouched
    txHandle.state = "rolledBack";
  }

  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (options?.retry) {
      this.logger.warn(
        "Transaction retry option is not supported by the Memory driver and will be ignored",
        { retry: options.retry },
      );
    }

    const handle = (await this.beginTransaction(options)) as MemoryTransactionHandle;

    const repoFactory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p);

    const ctx = new MemoryTransactionContext(handle, this, repoFactory);

    try {
      const result = await callback(ctx);

      if (handle.state === "active") {
        await this.commitTransaction(handle);
      }

      return result;
    } catch (error) {
      if (handle.state === "active") {
        await this.rollbackTransaction(handle);
      }
      throw error;
    }
  }

  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    emitEntity: EntityEmitFn,
  ): MemoryDriver {
    const cloned = Object.create(MemoryDriver.prototype) as MemoryDriver;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    (cloned as any).getFilterRegistry = getFilterRegistry;
    (cloned as any).emitEntity = emitEntity;
    (cloned as any).amphora = this.amphora;
    (cloned as any).store = this.store; // Share the same in-memory store
    return cloned;
  }

  // ─── Private ─────────────────────────────────────────────────────────

  private createExecutorForStore<E extends IEntity>(
    target: Constructor<E>,
    store: MemoryStore,
  ): MemoryExecutor<E> {
    const metadata = this.resolveMetadata(target);
    const tableKey = this.getTableKey(target);

    return new MemoryExecutor<E>(
      metadata,
      (): MemoryTable =>
        store.tables.get(tableKey) ??
        ((): MemoryTable => {
          const t: MemoryTable = new Map();
          store.tables.set(tableKey, t);
          return t;
        })(),
      (): MemoryStore => store,
      this.getFilterRegistry(),
      this.amphora,
    );
  }
}
