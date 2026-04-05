import Redis from "ioredis";
import type { IAmphora } from "@lindorm/amphora";
import type { ICircuitBreaker } from "@lindorm/breaker";
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
  ProteusRedisOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types";
import type { EntityEmitFn } from "../../../../types/event-map";
import type { RepositoryFactory } from "#internal/types/repository-factory";
import type { FilterRegistry } from "#internal/utils/query/filter-registry";
import type { RedisTransactionHandle } from "../types/redis-types";
import { BreakerExecutor } from "#internal/classes/BreakerExecutor";
import { RedisDriverError } from "../errors/RedisDriverError";
import { validateConnectionMutualExclusivity } from "#internal/utils/validate-connection-options";
import { RedisExecutor } from "./RedisExecutor";
import { RedisQueryBuilder } from "./RedisQueryBuilder";
import { RedisRepository } from "./RedisRepository";
import { RedisTransactionContext } from "./RedisTransactionContext";
import { validateRedisEntity } from "../utils/validate-redis-entity";

export class RedisDriver implements IProteusDriver {
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly emitEntity: EntityEmitFn;
  private readonly amphora: IAmphora | undefined;
  private readonly breaker: ICircuitBreaker | null;
  private readonly connectionConfig: {
    url?: string;
    host?: string;
    port?: number;
    username?: string;
    password?: string;
    db?: number;
    maxRetriesPerRequest?: number | null;
    connectTimeout?: number;
    commandTimeout?: number;
    keepAlive?: number;
    connectionName?: string;
    enableReadyCheck?: boolean;
    tls?: Record<string, unknown>;
    retryStrategy?: (times: number) => number | null;
  };
  private client: Redis | null;
  private connectingPromise: Promise<void> | null;

  public constructor(
    options: ProteusRedisOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    emitEntity?: EntityEmitFn,
    amphora?: IAmphora,
    breaker?: ICircuitBreaker | null,
  ) {
    this.logger = logger.child(["RedisDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? ((): FilterRegistry => new Map());
    this.emitEntity = emitEntity ?? (async () => {});
    this.amphora = amphora;
    this.breaker = breaker ?? null;
    this.connectionConfig = {
      url: options.url,
      host: options.host,
      port: options.port,
      username: options.user,
      password: options.password,
      db: options.db,
      maxRetriesPerRequest: options.maxRetriesPerRequest,
      connectTimeout: options.connectTimeout,
      commandTimeout: options.commandTimeout,
      keepAlive: options.keepAlive,
      connectionName: options.connectionName,
      enableReadyCheck: options.enableReadyCheck,
      tls: options.tls as Record<string, unknown> | undefined,
      retryStrategy: options.retryStrategy,
    };
    this.client = null;
    this.connectingPromise = null;
  }

  // ─── Connection Lifecycle ─────────────────────────────────────────────

  public async connect(): Promise<void> {
    if (this.client) {
      this.logger.debug("Redis driver already connected");
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
      this.logger.debug("Redis driver already disconnected");
      return;
    }

    const c = this.client;
    this.client = null;
    try {
      await c.quit();
    } catch {
      /* already disconnected */
    }
    this.logger.debug("Redis driver disconnected");
  }

  public async ping(): Promise<boolean> {
    const result = await this.requireClient().ping();
    return result === "PONG";
  }

  // ─── Setup ────────────────────────────────────────────────────────────

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    for (const target of entities) {
      const metadata = this.resolveMetadata(target);
      validateRedisEntity(metadata, this.logger);
    }

    this.logger.debug("Redis driver setup complete", { entities: entities.length });
  }

  // ─── Repository ───────────────────────────────────────────────────────

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    // NOTE (F-040): resolveMetadata applies naming strategy (DB column names).
    // The executor receives this transformed metadata for HSET/HGETALL keys.
    // DriverRepositoryBase separately calls getEntityMetadata (raw TS property names)
    // for relation loading, hydration, and lifecycle hooks. This dual-resolution
    // is intentional: base class works at the TS level (field.key), executor at
    // the DB level (field.name). Both are consistent within their domain.
    const metadata = this.resolveMetadata(target);
    const client = this.requireClient();

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, context);

    return new RedisRepository<E>({
      target,
      executor: this.wrapExecutor(
        new RedisExecutor<E>(
          metadata,
          client,
          this.namespace,
          this.getFilterRegistry(),
          undefined,
          this.amphora,
        ),
      ),
      queryBuilderFactory: () => this.createQueryBuilder(target),
      client,
      namespace: this.namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      emitEntity: this.emitEntity,
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    _handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): IProteusRepository<E> {
    // Redis has no transaction isolation -- delegate to non-transactional repository
    return this.createRepository(target, parent, context);
  }

  // ─── Executor ─────────────────────────────────────────────────────────

  public createExecutor<E extends IEntity>(
    target: Constructor<E>,
  ): IRepositoryExecutor<E> {
    const metadata = this.resolveMetadata(target);

    return this.wrapExecutor(
      new RedisExecutor<E>(
        metadata,
        this.requireClient(),
        this.namespace,
        this.getFilterRegistry(),
        undefined,
        this.amphora,
      ),
    );
  }

  public createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    _handle: TransactionHandle,
  ): IRepositoryExecutor<E> {
    // Redis has no transaction isolation -- return the same executor
    return this.createExecutor(target);
  }

  // ─── Query Builder ────────────────────────────────────────────────────

  public createQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);

    return new RedisQueryBuilder<E>(
      metadata,
      this.requireClient(),
      this.namespace,
      this.logger,
      this.getFilterRegistry(),
      this.amphora,
    );
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    _handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    // Redis has no transaction isolation -- return the same query builder
    return this.createQueryBuilder(target);
  }

  // ─── Client Access ────────────────────────────────────────────────────

  public async acquireClient(): Promise<Redis> {
    return this.requireClient();
  }

  // ─── Transactions (No-op) ─────────────────────────────────────────────

  public async beginTransaction(
    _options?: TransactionOptions,
  ): Promise<TransactionHandle> {
    const handle: RedisTransactionHandle = {
      state: "active",
    };
    return handle;
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as RedisTransactionHandle;
    if (txHandle.state !== "active") {
      throw new RedisDriverError(`Cannot commit: transaction is ${txHandle.state}`);
    }
    txHandle.state = "committed";
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    const txHandle = handle as RedisTransactionHandle;
    if (txHandle.state !== "active") {
      throw new RedisDriverError(`Cannot rollback: transaction is ${txHandle.state}`);
    }
    txHandle.state = "rolledBack";
  }

  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    _options?: TransactionOptions,
  ): Promise<T> {
    this.logger.warn(
      "Redis does not support interactive transactions — " +
        "the callback will execute without atomicity or isolation guarantees",
    );

    const handle = (await this.beginTransaction()) as RedisTransactionHandle;

    const repoFactory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p);

    const ctx = new RedisTransactionContext(handle, this, repoFactory);

    try {
      const result = await callback(ctx);

      if (handle.state === "active") {
        await this.commitTransaction(handle);
      }

      return result;
    } catch (error) {
      if (handle.state === "active") {
        await this.rollbackTransaction(handle);
      } else {
        this.logger.warn(
          `Transaction already ${handle.state} before error handler — the error occurred after the transaction completed`,
          { error },
        );
      }
      throw error;
    }
  }

  // ─── Clone ────────────────────────────────────────────────────────────

  // IMPORTANT: When adding new fields to RedisDriver, they MUST be added here too.
  // This method bypasses TypeScript's private/readonly via (cloned as any) — there
  // is no compile-time check for missing fields.
  // Fields: client, options, logger, filterRegistry, connectingPromise, [any new fields]
  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    emitEntity: EntityEmitFn,
  ): RedisDriver {
    const cloned = Object.create(RedisDriver.prototype) as RedisDriver;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    (cloned as any).getFilterRegistry = getFilterRegistry;
    (cloned as any).emitEntity = emitEntity;
    (cloned as any).connectionConfig = this.connectionConfig;
    (cloned as any).amphora = this.amphora;
    (cloned as any).breaker = this.breaker;
    (cloned as any).client = this.client; // Share the same ioredis client
    (cloned as any).connectingPromise = null;
    return cloned;
  }

  // ─── Private ──────────────────────────────────────────────────────────

  private async doConnect(): Promise<void> {
    validateConnectionMutualExclusivity({
      url: this.connectionConfig.url,
      host: this.connectionConfig.host,
      port: this.connectionConfig.port,
      user: this.connectionConfig.username,
      password: this.connectionConfig.password,
    });

    const shared: Record<string, unknown> = {
      lazyConnect: true,
      maxRetriesPerRequest: this.connectionConfig.maxRetriesPerRequest ?? 3,
    };

    if (this.connectionConfig.retryStrategy != null)
      shared.retryStrategy = this.connectionConfig.retryStrategy;
    if (this.connectionConfig.connectTimeout != null)
      shared.connectTimeout = this.connectionConfig.connectTimeout;
    if (this.connectionConfig.commandTimeout != null)
      shared.commandTimeout = this.connectionConfig.commandTimeout;
    if (this.connectionConfig.keepAlive != null)
      shared.keepAlive = this.connectionConfig.keepAlive;
    if (this.connectionConfig.connectionName != null)
      shared.connectionName = this.connectionConfig.connectionName;
    if (this.connectionConfig.enableReadyCheck != null)
      shared.enableReadyCheck = this.connectionConfig.enableReadyCheck;
    if (this.connectionConfig.tls != null) shared.tls = this.connectionConfig.tls;

    let client: Redis;
    if (this.connectionConfig.url) {
      client = new Redis(this.connectionConfig.url, shared as any);
    } else {
      client = new Redis({
        host: this.connectionConfig.host ?? "127.0.0.1",
        port: this.connectionConfig.port ?? 6379,
        username: this.connectionConfig.username,
        password: this.connectionConfig.password,
        db: this.connectionConfig.db ?? 0,
        ...shared,
      } as any);
    }

    await client.connect();
    this.client = client;

    if (this.breaker) {
      client.on("close", () => this.breaker!.open());
      client.on("ready", () => this.breaker!.close());
    }

    this.logger.debug("Redis driver connected");
  }

  private wrapExecutor<E extends IEntity>(
    executor: IRepositoryExecutor<E>,
  ): IRepositoryExecutor<E> {
    return this.breaker ? new BreakerExecutor(executor, this.breaker) : executor;
  }

  private requireClient(): Redis {
    if (!this.client) {
      throw new RedisDriverError("Redis client is not connected. Call connect() first.");
    }
    return this.client;
  }
}
