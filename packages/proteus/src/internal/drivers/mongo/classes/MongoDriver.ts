import {
  MongoClient,
  type Db,
  type CreateIndexesOptions,
  type IndexSpecification,
} from "mongodb";
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
  SubscriberRegistryGetter,
  TransactionHandle,
} from "../../../interfaces/ProteusDriver";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type {
  ProteusMongoOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types";
import type { RepositoryFactory } from "#internal/types/repository-factory";
import type { FilterRegistry } from "#internal/utils/query/filter-registry";
import type { IEntitySubscriber } from "../../../../interfaces/EntitySubscriber";
import type { MongoTransactionHandle } from "../types/mongo-types";
import { detectReplicaSet } from "../utils/detect-replica-set";
import { createMongoJoinTableOps } from "../utils/mongo-join-table-ops";
import { mapIsolationLevel } from "../utils/map-isolation-level";
import { isRetryableMongoError } from "../utils/is-retryable-mongo-error";
import { withRetry } from "#internal/utils/transaction/with-retry";
import { validateConnectionMutualExclusivity } from "#internal/utils/validate-connection-options";
import { MongoDriverError } from "../errors/MongoDriverError";
import { MongoMigrationError } from "../errors/MongoMigrationError";
import { MongoExecutor } from "./MongoExecutor";
import { MongoMigrationManager } from "./MongoMigrationManager";
import { MongoQueryBuilder } from "./MongoQueryBuilder";
import { MongoRepository } from "./MongoRepository";
import { MongoTransactionContext } from "./MongoTransactionContext";
import { NotSupportedError } from "../../../../errors/NotSupportedError";
import { resolveCollectionName } from "../utils/resolve-collection-name";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import { diffIndexes } from "../utils/sync/diff-indexes";
import { executeSync } from "../utils/sync/execute-sync";
import { introspectIndexes } from "../utils/sync/introspect-indexes";
import { projectDesiredIndexes } from "../utils/sync/project-desired-indexes";

export class MongoDriver implements IProteusDriver {
  private readonly options: ProteusMongoOptions;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly getSubscribers: SubscriberRegistryGetter;
  private readonly amphora: IAmphora | undefined;
  private readonly connectionConfig: {
    url?: string;
    host?: string;
    port?: number;
    user?: string;
    password?: string;
    database?: string;
    replicaSet?: string;
    readPreference?: string;
    writeConcern?: { w?: number | string; j?: boolean };
    authSource?: string;
  };
  private client: MongoClient | null;
  private db: Db | null;
  private isReplicaSet: boolean;
  private connectingPromise: Promise<void> | null;

  public constructor(
    options: ProteusMongoOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    getSubscribers?: SubscriberRegistryGetter,
    amphora?: IAmphora,
  ) {
    this.options = options;
    this.logger = logger.child(["MongoDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? ((): FilterRegistry => new Map());
    this.getSubscribers = getSubscribers ?? ((): ReadonlyArray<IEntitySubscriber> => []);
    this.amphora = amphora;
    this.connectionConfig = {
      url: options.url,
      host: options.host,
      port: options.port,
      user: options.user,
      password: options.password,
      database: options.database,
      replicaSet: options.replicaSet,
      readPreference: options.readPreference,
      writeConcern: options.writeConcern,
      authSource: options.authSource,
    };
    this.client = null;
    this.db = null;
    this.isReplicaSet = false;
    this.connectingPromise = null;
  }

  // ─── Connection Lifecycle ─────────────────────────────────────────────

  public async connect(): Promise<void> {
    if (this.client) {
      this.logger.debug("MongoDB driver already connected");
      return;
    }

    if (this.connectingPromise) {
      return this.connectingPromise;
    }

    this.connectingPromise = this.doConnect();

    try {
      await this.connectingPromise;
    } finally {
      this.connectingPromise = null;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.client) {
      this.logger.debug("MongoDB driver already disconnected");
      return;
    }

    const c = this.client;
    this.client = null;
    this.db = null;
    try {
      await c.close();
    } catch {
      /* already disconnected */
    }
    this.logger.debug("MongoDB driver disconnected");
  }

  public async ping(): Promise<boolean> {
    const db = this.requireDb();
    const result = await db.command({ ping: 1 });
    return result.ok === 1;
  }

  // ─── Setup ────────────────────────────────────────────────────────────

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (this.options.synchronize && this.options.runMigrations) {
      throw new MongoMigrationError(
        "synchronize and runMigrations are mutually exclusive — use one or the other",
      );
    }

    // Auto-connect if not already connected
    if (!this.client) {
      await this.connect();
    }

    if (this.options.runMigrations) {
      await this.runMigrations();
    } else if (this.options.synchronize) {
      await this.synchronize(entities);
    }

    const db = this.requireDb();

    for (const target of entities) {
      const metadata = this.resolveMetadata(target);
      const collectionName = resolveCollectionName(metadata);

      // Create entity collection (idempotent)
      await this.createCollectionSafe(db, collectionName);

      // Create version shadow collection for entities with @Version
      const hasVersion = metadata.fields.some((f) => f.decorator === "Version");
      if (hasVersion) {
        const shadowCollectionName = `${collectionName}_versions`;
        await this.createCollectionSafe(db, shadowCollectionName);

        // Create compound index on shadow collection for temporal lookups
        const shadowCollection = db.collection(shadowCollectionName);
        await shadowCollection
          .createIndex(
            { __entityId: 1, __versionedAt: -1 },
            { name: `proteus_idx_${shadowCollectionName}_entity_versioned` },
          )
          .catch((err) => {
            if (!this.isIndexExistsError(err))
              this.logger.warn("Failed to create shadow version index", { error: err });
          });
      }

      // Create TTL indexes for @ExpiryDateField
      const expiryField = metadata.fields.find((f) => f.decorator === "ExpiryDate");
      if (expiryField) {
        const collection = db.collection(collectionName);
        await collection
          .createIndex(
            { [expiryField.name]: 1 },
            {
              name: `proteus_ttl_${collectionName}_${expiryField.name}`,
              expireAfterSeconds: 0,
            },
          )
          .catch((err) => {
            if (!this.isIndexExistsError(err))
              this.logger.warn("Failed to create TTL index", { error: err });
          });
      }

      // Create FK indexes for relations
      for (const relation of metadata.relations) {
        if (!relation.joinKeys) continue;

        if (relation.type === "ManyToMany" && typeof relation.joinTable === "string") {
          // Create join collection for M2M
          await this.createCollectionSafe(db, relation.joinTable);

          // Create compound unique index on join collection including BOTH sides.
          // relation.joinKeys only has this side's columns; we need the mirror's too.
          const joinCollection = db.collection(relation.joinTable);
          const indexSpec: IndexSpecification = {};
          for (const localKey of Object.keys(relation.joinKeys)) {
            indexSpec[localKey] = 1;
          }

          // Find mirror relation's join keys to include the other side
          const foreignTarget = relation.foreignConstructor();
          const foreignMeta = getEntityMetadata(foreignTarget);
          const mirrorRelation = foreignMeta.relations.find(
            (r) =>
              r.type === "ManyToMany" &&
              r.joinTable === relation.joinTable &&
              r.foreignKey === relation.key,
          );
          if (mirrorRelation?.joinKeys) {
            for (const foreignKey of Object.keys(mirrorRelation.joinKeys)) {
              indexSpec[foreignKey] = 1;
            }
          }

          await joinCollection
            .createIndex(indexSpec, {
              name: `proteus_idx_${relation.joinTable}_compound`,
              unique: true,
            })
            .catch((err) => {
              if (!this.isIndexExistsError(err))
                this.logger.warn("Failed to create M2M join index", { error: err });
            });
        } else {
          // Create FK index on the entity collection for non-M2M relations
          const collection = db.collection(collectionName);
          const fkKeys = Object.keys(relation.joinKeys);
          const indexSpec: IndexSpecification = {};
          for (const fk of fkKeys) {
            const field = metadata.fields.find((f) => f.key === fk);
            indexSpec[field?.name ?? fk] = 1;
          }
          const indexName = `proteus_idx_${collectionName}_${fkKeys.join("_")}`;
          await collection.createIndex(indexSpec, { name: indexName }).catch((err) => {
            if (!this.isIndexExistsError(err))
              this.logger.warn("Failed to create FK index", { error: err });
          });
        }
      }

      // Create embedded list collections (A09)
      for (const el of metadata.embeddedLists) {
        await this.createCollectionSafe(db, el.tableName);

        // Index on parent FK for efficient lookups
        const elCollection = db.collection(el.tableName);
        await elCollection
          .createIndex(
            { [el.parentFkColumn]: 1 },
            { name: `proteus_idx_${el.tableName}_${el.parentFkColumn}` },
          )
          .catch((err) => {
            if (!this.isIndexExistsError(err))
              this.logger.warn("Failed to create embedded list index", { error: err });
          });
      }

      // Create decorator-defined indexes
      for (const index of metadata.indexes) {
        const collection = db.collection(collectionName);
        const indexSpec: IndexSpecification = {};
        for (const item of index.keys) {
          const field = metadata.fields.find((f) => f.key === item.key);
          const mongoField = metadata.primaryKeys.includes(item.key)
            ? "_id"
            : (field?.name ?? item.key);
          indexSpec[mongoField] = item.direction === "desc" ? -1 : 1;
        }

        const indexOpts: CreateIndexesOptions = {
          unique: index.unique || undefined,
          sparse: index.sparse || undefined,
        };

        if (index.name) {
          indexOpts.name = index.name;
        }

        await collection.createIndex(indexSpec, indexOpts).catch((err) => {
          if (!this.isIndexExistsError(err))
            this.logger.warn("Failed to create user-defined index", { error: err });
        });
      }
    }

    this.logger.debug("MongoDB driver setup complete", { entities: entities.length });
  }

  // ─── Repository ───────────────────────────────────────────────────────

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    const metadata = this.resolveMetadata(target);
    const db = this.requireDb();

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, context);

    return new MongoRepository<E>({
      target,
      executor: new MongoExecutor<E>(
        metadata,
        db,
        this.namespace,
        this.getFilterRegistry(),
        undefined,
        this.amphora,
      ),
      queryBuilderFactory: () => this.createQueryBuilder(target),
      db,
      namespace: this.namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      getSubscribers: this.getSubscribers,
      joinTableOps: createMongoJoinTableOps(db),
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    const txHandle = handle as MongoTransactionHandle;
    const metadata = this.resolveMetadata(target);
    const db = this.requireDb();

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p, context);

    return new MongoRepository<E>({
      target,
      executor: new MongoExecutor<E>(
        metadata,
        db,
        this.namespace,
        this.getFilterRegistry(),
        txHandle.session,
        this.amphora,
      ),
      queryBuilderFactory: () => this.createTransactionalQueryBuilder(target, handle),
      db,
      namespace: this.namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      getSubscribers: this.getSubscribers,
      joinTableOps: createMongoJoinTableOps(db, txHandle.session),
      session: txHandle.session,
    });
  }

  // ─── Executor ─────────────────────────────────────────────────────────

  public createExecutor<E extends IEntity>(
    target: Constructor<E>,
  ): IRepositoryExecutor<E> {
    const metadata = this.resolveMetadata(target);

    return new MongoExecutor<E>(
      metadata,
      this.requireDb(),
      this.namespace,
      this.getFilterRegistry(),
      undefined,
      this.amphora,
    );
  }

  public createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IRepositoryExecutor<E> {
    const txHandle = handle as MongoTransactionHandle;
    const metadata = this.resolveMetadata(target);

    return new MongoExecutor<E>(
      metadata,
      this.requireDb(),
      this.namespace,
      this.getFilterRegistry(),
      txHandle.session,
      this.amphora,
    );
  }

  // ─── Query Builder ────────────────────────────────────────────────────

  public createQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);
    const db = this.requireDb();

    return new MongoQueryBuilder<E>(
      metadata,
      db,
      this.namespace,
      this.logger,
      this.getFilterRegistry(),
      undefined,
      this.amphora,
    );
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    const txHandle = handle as MongoTransactionHandle;
    const metadata = this.resolveMetadata(target);
    const db = this.requireDb();

    return new MongoQueryBuilder<E>(
      metadata,
      db,
      this.namespace,
      this.logger,
      this.getFilterRegistry(),
      txHandle.session,
      this.amphora,
    );
  }

  // ─── Client Access ────────────────────────────────────────────────────

  public async acquireClient(): Promise<Db> {
    return this.requireDb();
  }

  // ─── Transactions ─────────────────────────────────────────────────────

  public async beginTransaction(
    options?: TransactionOptions,
  ): Promise<TransactionHandle> {
    if (!this.isReplicaSet) {
      throw new NotSupportedError(
        "MongoDB transactions require a replica set. Current connection is standalone.",
      );
    }

    const client = this.requireClient();
    const session = client.startSession();
    const concern = mapIsolationLevel(options?.isolation);

    session.startTransaction({
      readConcern: concern.readConcern,
      writeConcern: concern.writeConcern,
    });

    const handle: MongoTransactionHandle = {
      session,
      state: "active",
    };

    return handle;
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as MongoTransactionHandle;
    if (txHandle.state !== "active") {
      throw new MongoDriverError(`Cannot commit: transaction is ${txHandle.state}`);
    }

    if (!txHandle.session) {
      // Standalone mode — no real transaction to commit
      txHandle.state = "committed";
      return;
    }

    try {
      await txHandle.session.commitTransaction();
      txHandle.state = "committed";
    } catch (error) {
      txHandle.state = "rolledBack";
      throw error;
    } finally {
      await txHandle.session.endSession();
    }
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as MongoTransactionHandle;
    if (txHandle.state !== "active") {
      throw new MongoDriverError(`Cannot rollback: transaction is ${txHandle.state}`);
    }

    if (!txHandle.session) {
      // Standalone mode — no real transaction to rollback
      txHandle.state = "rolledBack";
      return;
    }

    try {
      await txHandle.session.abortTransaction();
    } finally {
      txHandle.state = "rolledBack";
      await txHandle.session.endSession();
    }
  }

  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    if (!this.isReplicaSet) {
      this.logger.warn(
        "MongoDB transactions require a replica set — " +
          "the callback will execute without atomicity or isolation guarantees",
      );

      const repoFactory: RepositoryFactory = <C extends IEntity>(
        t: Constructor<C>,
        p?: Constructor<IEntity>,
      ) => this.createRepository(t, p);

      const handle: MongoTransactionHandle = { session: undefined, state: "active" };
      const ctx = new MongoTransactionContext(handle, this, repoFactory);

      try {
        const result = await callback(ctx);
        handle.state = "committed";
        return result;
      } catch (error) {
        handle.state = "rolledBack";
        throw error;
      }
    }

    const attempt = async (): Promise<T> => {
      const handle = (await this.beginTransaction(options)) as MongoTransactionHandle;

      const repoFactory: RepositoryFactory = <C extends IEntity>(
        t: Constructor<C>,
        p?: Constructor<IEntity>,
      ) => this.createTransactionalRepository(t, handle, p);

      const ctx = new MongoTransactionContext(handle, this, repoFactory);

      try {
        const result = await callback(ctx);

        if (handle.state === "active") {
          await this.commitTransaction(handle);
        }

        return result;
      } catch (error) {
        if (handle.state === "active") {
          try {
            await this.rollbackTransaction(handle);
          } catch {
            // Swallow rollback error — preserve the original error
          }
        } else {
          this.logger.warn(
            `Transaction already ${handle.state} before error handler — the error occurred after the transaction completed`,
            { error },
          );
        }
        throw error;
      }
    };

    if (options?.retry) {
      const retryOptions = {
        ...options.retry,
        onRetry:
          options.retry.onRetry ??
          ((attempt: number, error: unknown): void => {
            this.logger.warn("Retrying MongoDB transaction", {
              attempt,
              error: error instanceof Error ? error.message : String(error),
            });
          }),
      };
      return withRetry(attempt, isRetryableMongoError, retryOptions);
    }

    return attempt();
  }

  // ─── Clone ────────────────────────────────────────────────────────────

  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    getSubscribers: SubscriberRegistryGetter,
  ): MongoDriver {
    const cloned = Object.create(MongoDriver.prototype) as MongoDriver;
    (cloned as any).options = this.options;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    (cloned as any).getFilterRegistry = getFilterRegistry;
    (cloned as any).getSubscribers = getSubscribers;
    (cloned as any).connectionConfig = this.connectionConfig;
    (cloned as any).amphora = this.amphora;
    (cloned as any).client = this.client;
    (cloned as any).db = this.db;
    (cloned as any).isReplicaSet = this.isReplicaSet;
    (cloned as any).connectingPromise = null;
    return cloned;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async synchronize(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (!this.options.synchronize) return;

    this.logger.warn(
      "Synchronize mode is enabled. This is intended for development only.",
    );

    const db = this.requireDb();

    // Collect metadata for all registered entities
    const metadatas = entities.map((e) => this.resolveMetadata(e));

    // Project desired indexes from entity metadata
    const desired = projectDesiredIndexes(metadatas, this.namespace);

    // Collect all referenced collection names for introspection
    const allCollections = new Set<string>();
    for (const idx of desired) {
      allCollections.add(idx.collection);
    }

    // Introspect existing proteus-managed indexes
    const existing = await introspectIndexes(db, [...allCollections]);

    // Determine existing collections
    const existingCollections = new Set<string>();
    for (const idx of existing) {
      existingCollections.add(idx.collection);
    }
    const dbCollections = await db.listCollections().toArray();
    for (const c of dbCollections) {
      existingCollections.add(c.name);
    }

    // Diff and execute
    const plan = diffIndexes(existing, desired, existingCollections);
    const dryRun = this.options.synchronize === "dry-run";

    await executeSync(db, plan, this.logger, { dryRun });

    if (dryRun) {
      const totalOps =
        plan.collectionsToCreate.length +
        plan.indexesToDrop.length +
        plan.indexesToCreate.length;
      this.logger.info(`Dry-run sync complete: ${totalOps} operations planned`);
    }
  }

  private async runMigrations(): Promise<void> {
    const directories = this.options.migrations ?? [];

    if (directories.length === 0) {
      this.logger.debug("No migration directories configured — skipping");
      return;
    }

    const db = this.requireDb();
    const tableName = this.options.migrationsTable;

    for (const directory of directories) {
      const manager = new MongoMigrationManager({
        client: this.requireClient(),
        db,
        directory,
        logger: this.logger,
        namespace: this.namespace,
        isReplicaSet: this.isReplicaSet,
        tableName,
      });

      const result = await manager.apply();

      if (result.applied.length > 0) {
        this.logger.info(
          `Applied ${result.applied.length} migration(s) from ${directory}: ${result.applied.map((a) => a.name).join(", ")}`,
        );
      } else {
        this.logger.debug(`No pending migrations in ${directory}`);
      }
    }
  }

  private async doConnect(): Promise<void> {
    validateConnectionMutualExclusivity(this.connectionConfig);

    const url = this.buildConnectionUrl();
    const options: Record<string, unknown> = {};

    if (this.connectionConfig.replicaSet) {
      options.replicaSet = this.connectionConfig.replicaSet;
    }
    if (this.connectionConfig.readPreference) {
      options.readPreference = this.connectionConfig.readPreference;
    }
    if (this.connectionConfig.writeConcern) {
      options.writeConcern = this.connectionConfig.writeConcern;
    }
    if (this.connectionConfig.authSource) {
      options.authSource = this.connectionConfig.authSource;
    }

    // directConnection required for single-node replica sets
    options.directConnection = true;

    const mongoClient = new MongoClient(url, options as any);
    await mongoClient.connect();

    const databaseName = this.connectionConfig.database ?? this.namespace ?? "default";
    const db = mongoClient.db(databaseName);

    // Detect replica set
    const isReplicaSet = await detectReplicaSet(mongoClient.db("admin").admin());

    this.client = mongoClient;
    this.db = db;
    this.isReplicaSet = isReplicaSet;

    if (!this.isReplicaSet) {
      this.logger.warn(
        "MongoDB is running in standalone mode — transactions will not be available",
      );
    }

    this.logger.debug("MongoDB driver connected", {
      database: databaseName,
      isReplicaSet: this.isReplicaSet,
    });
  }

  private buildConnectionUrl(): string {
    if (this.connectionConfig.url) return this.connectionConfig.url;

    const host = this.connectionConfig.host ?? "localhost";
    const port = this.connectionConfig.port ?? 27017;

    if (this.connectionConfig.user && this.connectionConfig.password) {
      const user = encodeURIComponent(this.connectionConfig.user);
      const password = encodeURIComponent(this.connectionConfig.password);
      return `mongodb://${user}:${password}@${host}:${port}`;
    }

    return `mongodb://${host}:${port}`;
  }

  private requireClient(): MongoClient {
    if (!this.client) {
      throw new MongoDriverError(
        "MongoDB client is not connected. Call connect() first.",
      );
    }
    return this.client;
  }

  private requireDb(): Db {
    if (!this.db) {
      throw new MongoDriverError(
        "MongoDB client is not connected. Call connect() first.",
      );
    }
    return this.db;
  }

  private isIndexExistsError(error: any): boolean {
    // MongoDB codes: 68 = IndexAlreadyExists, 85 = IndexOptionsConflict, 86 = IndexKeySpecsConflict
    const code = error?.code;
    return code === 68 || code === 85 || code === 86;
  }

  private async createCollectionSafe(db: Db, name: string): Promise<void> {
    try {
      await db.createCollection(name);
    } catch (error: any) {
      // Ignore "Collection already exists" error (code 48)
      if (error?.codeName !== "NamespaceExists" && error?.code !== 48) {
        throw error;
      }
    }
  }
}
