import { EventEmitter } from "events";
import type { IAmphora } from "@lindorm/amphora";
import {
  CircuitBreaker,
  type CircuitBreakerOptions,
  type ICircuitBreaker,
} from "@lindorm/breaker";
import { ms } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { Constructor, Dict } from "@lindorm/types";
import { NotSupportedError, ProteusError } from "../errors/index.js";
import type {
  IEntity,
  IProteusQueryBuilder,
  IProteusRepository,
  IProteusSource,
} from "../interfaces/index.js";
import { ProteusSession } from "./ProteusSession.js";
import type { ICacheAdapter } from "../interfaces/CacheAdapter.js";
import type {
  EntityEmitFn,
  EntityScannerInput,
  NamingStrategy,
  ProteusBreakerOptions,
  ProteusHookMeta,
  ProteusSourceEventMap,
  ProteusSourceOptions,
  TransactionCallback,
  TransactionOptions,
} from "../types/index.js";
import { createDefaultProteusHookMeta } from "../types/proteus-hook-meta.js";
import { classifyMongoError } from "../internal/drivers/mongo/utils/classify-breaker-error.js";
import { classifyMysqlError } from "../internal/drivers/mysql/utils/classify-breaker-error.js";
import { classifyPostgresError } from "../internal/drivers/postgres/utils/classify-breaker-error.js";
import { classifyRedisError } from "../internal/drivers/redis/utils/classify-breaker-error.js";
import { CachingRepository } from "../internal/classes/CachingRepository.js";
import { EntityScanner } from "../internal/entity/classes/EntityScanner.js";
import { getEntityMetadata } from "../internal/entity/metadata/get-entity-metadata.js";
import { resolveInheritanceHierarchies } from "../internal/entity/metadata/resolve-inheritance.js";
import { clearPrimaryCache } from "../internal/entity/metadata/build-primary.js";
import { clearMetadataCache } from "../internal/entity/metadata/registry.js";
import { validateEncryptedFields } from "../internal/entity/utils/validate-encrypted-fields.js";
import { applyNamingStrategy } from "../internal/utils/naming/apply-naming-strategy.js";
import type { MetaInheritance } from "../internal/entity/types/inheritance.js";
import type {
  IProteusDriver,
  MetadataResolver,
} from "../internal/interfaces/ProteusDriver.js";
import {
  type FilterRegistry,
  createFilterRegistry,
  cloneFilterRegistry,
  setFilterParams as setFilterParamsUtil,
  enableFilter as enableFilterUtil,
  disableFilter as disableFilterUtil,
} from "../internal/utils/query/filter-registry.js";
import type { EntityMetadata } from "../internal/entity/types/metadata.js";

/**
 * Options for creating a session from a ProteusSource.
 */
export type SessionOptions = {
  /** Override the logger on the session. */
  logger?: ILogger;
  /** Override the request-scoped hook metadata on the session. */
  context?: ProteusHookMeta;
  /**
   * Optional AbortSignal scoped to the session. When aborted, in-flight queries
   * issued through this session are cancelled server-side (Postgres only).
   */
  signal?: AbortSignal;
};

/**
 * Central entry point for the Proteus ORM.
 *
 * Create one ProteusSource per application (or per tenant) and use it to
 * obtain repositories, query builders, and run transactions. The source
 * manages connection pooling, entity metadata resolution, and caching.
 */
export class ProteusSource implements IProteusSource {
  private _driver: IProteusDriver | undefined;
  private readonly _breaker: ICircuitBreaker | null;
  private readonly _options: ProteusSourceOptions;
  private readonly _amphora: IAmphora | undefined;
  private readonly logger: ILogger;
  private readonly context: ProteusHookMeta;
  private readonly _entities: Array<Constructor<IEntity>>;
  private readonly _pendingEntityPaths: Array<EntityScannerInput[number]>;
  private readonly resolveMetadata: MetadataResolver;
  private readonly cacheAdapter: ICacheAdapter | undefined;
  private readonly sourceTtlMs: number | undefined;
  private readonly _namespace: string | null;
  private readonly _driverType: string;
  private readonly _migrationsTable: string | undefined;
  private _registryRef: { current: FilterRegistry };
  private readonly _emitter: EventEmitter = new EventEmitter();
  private _inheritanceMap: Map<Function, MetaInheritance> | undefined;
  private _namingCache: Map<Function, EntityMetadata> | null = null;
  private _settingUpPromise: Promise<void> | null = null;
  private isSetUp = false;

  public constructor(options: ProteusSourceOptions) {
    this._options = options;
    this._amphora = options.amphora;
    this.logger = options.logger.child(["ProteusSource"]);
    this.context = options.context ?? createDefaultProteusHookMeta();
    // Pre-loaded classes go straight into _entities; string paths are deferred
    // to setup() since scanner.import() is async.
    this._entities = ((options.entities ?? []) as Array<unknown>).filter(
      (a): a is Constructor<IEntity> =>
        typeof a !== "string" && (a as any)?.prototype != null,
    );
    this._pendingEntityPaths = ((options.entities ?? []) as Array<unknown>).filter(
      (a): a is string => typeof a === "string",
    );

    const namespace = options.namespace ?? null;
    this._namespace = namespace;
    this._driverType = options.driver;
    this._migrationsTable =
      "migrationsTable" in options ? options.migrationsTable : undefined;
    this._registryRef = { current: createFilterRegistry() };
    const resolver = createMetadataResolver(
      options.naming ?? "none",
      () => this._inheritanceMap,
    );
    this.resolveMetadata = resolver.resolve;
    this._namingCache = resolver.cache;

    if (options.cache) {
      this.cacheAdapter = options.cache.adapter;
      this.sourceTtlMs = options.cache.ttl ? ms(options.cache.ttl) : undefined;
    }

    // Validate driver name eagerly — fail fast on typos or unimplemented drivers
    // without importing any driver modules.
    switch (options.driver) {
      case "postgres":
      case "memory":
      case "redis":
      case "sqlite":
      case "mysql":
        break;

      case "mongo":
        break;

      default: {
        const _exhaustive: never = options;
        throw new NotSupportedError(`Unknown driver "${(_exhaustive as any).driver}"`);
      }
    }

    this._breaker = this.createBreaker(options);
  }

  private requireDriver(): IProteusDriver {
    if (!this._driver) {
      throw new ProteusError("ProteusSource is not connected. Call connect() first.");
    }
    return this._driver;
  }

  public get namespace(): string | null {
    return this._namespace;
  }
  public get driverType(): string {
    return this._driverType;
  }
  public get migrationsTable(): string | undefined {
    return this._migrationsTable;
  }
  public get log(): ILogger {
    return this.logger;
  }

  // ─── Typed EventEmitter (composition) ──────────────────────────────

  /** Subscribe to a source event. */
  public on<K extends keyof ProteusSourceEventMap>(
    event: K,
    listener: (payload: ProteusSourceEventMap[K]) => void,
  ): void {
    this._emitter.on(event as string, listener);
  }

  /** Unsubscribe from a source event. */
  public off<K extends keyof ProteusSourceEventMap>(
    event: K,
    listener: (payload: ProteusSourceEventMap[K]) => void,
  ): void {
    this._emitter.off(event as string, listener);
  }

  /** Subscribe to a source event, firing only once. */
  public once<K extends keyof ProteusSourceEventMap>(
    event: K,
    listener: (payload: ProteusSourceEventMap[K]) => void,
  ): void {
    this._emitter.once(event as string, listener);
  }

  /**
   * Async entity emit function passed to drivers/repositories.
   * Listeners are awaited sequentially; errors propagate to the caller
   * (enabling transaction rollback).
   */
  private readonly emitEntity: EntityEmitFn = async (
    event: string,
    payload: unknown,
  ): Promise<void> => {
    const listeners = this._emitter.listeners(event);
    for (const listener of listeners) {
      await (listener as (p: unknown) => void | Promise<void>)(payload);
    }
  };

  /** Create a lightweight, request-scoped session sharing the same connection pool but with a new logger and/or context. */
  public session(options?: SessionOptions): ProteusSession {
    // Reference cell pattern: new ref cell for filter registry isolation.
    const registryRef = { current: cloneFilterRegistry(this._registryRef.current) };

    // The session's emit just bubbles to parent — can create before the session itself.
    const parentEmit = this.emitEntity;
    const sessionEmitEntity: EntityEmitFn = async (event, payload) => {
      await parentEmit(event, payload);
    };

    const clonedDriver = this._driver
      ? this._driver.cloneWithGetters(
          () => registryRef.current,
          sessionEmitEntity,
          options?.signal,
        )
      : undefined;

    return new ProteusSession({
      source: this,
      logger: options?.logger?.child(["ProteusSource"]) ?? this.logger,
      context: options?.context ?? this.context,
      registryRef,
      resolveMetadata: this.resolveMetadata,
      cacheAdapter: this.cacheAdapter,
      sourceTtlMs: this.sourceTtlMs,
      parentEmitEntity: parentEmit,
      driver: clonedDriver!,
      signal: options?.signal,
    });
  }

  /** Register parameter values for a named filter. Creates the filter entry if it does not exist. */
  public setFilterParams(name: string, params: Dict<unknown>): void {
    setFilterParamsUtil(this._registryRef.current, name, params);
  }

  /** Enable a named filter so it is applied to queries. */
  public enableFilter(name: string): void {
    enableFilterUtil(this._registryRef.current, name);
  }

  /** Disable a named filter so it is no longer applied to queries. */
  public disableFilter(name: string): void {
    disableFilterUtil(this._registryRef.current, name);
  }

  /**
   * Returns the live filter registry. Callers should treat it as read-only;
   * direct mutation will affect subsequent queries.
   */
  public getFilterRegistry(): FilterRegistry {
    return this._registryRef.current;
  }

  /** Register additional entity classes or glob patterns after construction. */
  public async addEntities(entities: EntityScannerInput): Promise<void> {
    if (this.isSetUp) {
      throw new ProteusError(
        "Cannot add entities after setup() has been called. Create a new ProteusSource instance instead.",
      );
    }
    const scanned = await EntityScanner.scan(entities);
    this._entities.push(...scanned.filter((Entity) => !this._entities.includes(Entity)));
  }

  /** Return resolved metadata for all registered entities. */
  public getEntityMetadata(): Array<EntityMetadata> {
    return this._entities.map((target) => this.resolveMetadata(target));
  }

  /** Check whether an entity class was registered with this source. */
  public hasEntity<E extends IEntity>(target: Constructor<E>): boolean {
    return this._entities.includes(target as Constructor<IEntity>);
  }

  /** Open the database connection (or connection pool). */
  public async connect(): Promise<void> {
    if (this._driver) return; // idempotent

    const getFilterRegistry = (): FilterRegistry => this._registryRef.current;
    const emitEntity = this.emitEntity;
    const opts = this._options;

    switch (opts.driver) {
      case "postgres": {
        const { PostgresDriver } =
          await import("../internal/drivers/postgres/classes/PostgresDriver.js");
        this._driver = new PostgresDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
          this._breaker,
        );
        break;
      }
      case "memory": {
        const { MemoryDriver } =
          await import("../internal/drivers/memory/classes/MemoryDriver.js");
        this._driver = new MemoryDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
        );
        break;
      }
      case "redis": {
        const { RedisDriver } =
          await import("../internal/drivers/redis/classes/RedisDriver.js");
        this._driver = new RedisDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
          this._breaker,
        );
        break;
      }
      case "sqlite": {
        const { SqliteDriver } =
          await import("../internal/drivers/sqlite/classes/SqliteDriver.js");
        this._driver = new SqliteDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
        );
        break;
      }
      case "mysql": {
        const { MySqlDriver } =
          await import("../internal/drivers/mysql/classes/MySqlDriver.js");
        this._driver = new MySqlDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
          this._breaker,
        );
        break;
      }
      case "mongo": {
        const { MongoDriver } =
          await import("../internal/drivers/mongo/classes/MongoDriver.js");
        this._driver = new MongoDriver(
          opts,
          this.logger,
          this._namespace,
          this.resolveMetadata,
          getFilterRegistry,
          emitEntity,
          this._amphora,
          this._breaker,
        );
        break;
      }
    }

    await this._driver.connect();

    try {
      await this.cacheAdapter?.connect?.();
    } catch (error) {
      try {
        await this._driver.disconnect();
      } catch {
        /* swallow */
      }
      this._driver = undefined;
      throw error;
    }

    this._emitter.emit("connection:state", { state: "connected" });
  }

  /** Close the database connection and drain the pool. */
  public async disconnect(): Promise<void> {
    if (!this._driver) return;

    try {
      await this._driver.disconnect();
    } finally {
      this._driver = undefined;
      this.isSetUp = false;
      try {
        await this.cacheAdapter?.disconnect?.();
      } catch {
        /* swallow — driver disconnect is the primary operation */
      }
      this._emitter.emit("connection:state", { state: "disconnected" });
    }
  }

  /** Check whether the database is reachable. Returns `true` on success. */
  public async ping(): Promise<boolean> {
    return this.requireDriver().ping();
  }

  /** Run schema synchronization, migrations, and index creation for all registered entities. Idempotent. */
  public async setup(): Promise<void> {
    if (this.isSetUp) return;
    if (this._settingUpPromise) return this._settingUpPromise;

    this._settingUpPromise = this._doSetup();
    try {
      await this._settingUpPromise;
    } finally {
      this._settingUpPromise = null;
    }
  }

  private async _doSetup(): Promise<void> {
    if (this._pendingEntityPaths.length) {
      const scanned = await EntityScanner.scan(this._pendingEntityPaths);
      for (const entity of scanned) {
        if (!this._entities.includes(entity)) {
          this._entities.push(entity);
        }
      }
      this._pendingEntityPaths.length = 0;
    }

    // Invalidate any metadata that may have been cached before setup() was called.
    clearPrimaryCache();
    clearMetadataCache();
    this._namingCache?.clear();

    // Resolve inheritance hierarchies across all entities before building metadata.
    // This must happen before any metadata is cached so that inheritance-aware
    // metadata (e.g. single-table field merging) is produced correctly.
    const inheritanceMap = resolveInheritanceHierarchies(this._entities);
    if (inheritanceMap.size > 0) {
      this._inheritanceMap = inheritanceMap;
    }

    // Filter out abstract entities — they have no tables of their own.
    // Use Object.hasOwn to check only the target's OWN __abstract flag,
    // not inherited from a parent (concrete subtypes of abstract parents
    // must not be filtered out).
    const concreteEntities = this._entities.filter((target) => {
      const meta = (target as any)[Symbol.metadata];
      return !meta || !Object.hasOwn(meta, "__abstract");
    });

    // Validate that any entity using @Encrypted has an amphora instance available.
    const resolvedMetadata = concreteEntities.map((target) =>
      this.resolveMetadata(target),
    );
    validateEncryptedFields(resolvedMetadata, this._amphora);

    await this.requireDriver().setup(concreteEntities);
    this.isSetUp = true;
  }

  /** Obtain a repository for the given entity class. Wraps with caching if a cache adapter is configured. */
  public repository<E extends IEntity>(target: Constructor<E>): IProteusRepository<E> {
    const inner = this.requireDriver().createRepository(target, undefined, this.context);
    if (!this.cacheAdapter) return inner;

    const metadata = this.resolveMetadata(target);
    return new CachingRepository<E>({
      inner,
      adapter: this.cacheAdapter,
      metadata,
      namespace: this._namespace,
      sourceTtlMs: this.sourceTtlMs,
      logger: this.logger,
    });
  }

  /** Create a query builder for the given entity class. */
  public queryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    return this.requireDriver().createQueryBuilder(target);
  }

  /** Acquire the underlying driver client (e.g. a pg PoolClient) for advanced use cases. */
  public async client<T>(): Promise<T> {
    return this.requireDriver().acquireClient() as Promise<T>;
  }

  /** Execute a callback within a database transaction. Commits on success, rolls back on error. */
  public async transaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    return this.requireDriver().withTransaction(callback, options);
  }

  /** The circuit breaker protecting this source's database operations, or `null` if disabled. */
  public get breaker(): ICircuitBreaker | null {
    return this._breaker;
  }

  private createBreaker(options: ProteusSourceOptions): ICircuitBreaker | null {
    // No breaker for drivers without network I/O
    if (options.driver === "memory" || options.driver === "sqlite") return null;

    // Explicitly disabled
    if (options.breaker === false) return null;

    const userOpts: ProteusBreakerOptions =
      typeof options.breaker === "object" ? options.breaker : {};

    const breakerOptions: CircuitBreakerOptions = {
      name: `proteus:${options.driver}`,
      classifier: userOpts.classifier ?? resolveDefaultClassifier(options.driver),
      threshold: userOpts.threshold,
      window: userOpts.window,
      halfOpenDelay: userOpts.halfOpenDelay,
      halfOpenBackoff: userOpts.halfOpenBackoff,
      halfOpenMaxDelay: userOpts.halfOpenMaxDelay,
    };

    const breaker = new CircuitBreaker(breakerOptions);

    const forwardBreakerEvent = (
      event: import("@lindorm/breaker").StateChangeEvent,
    ): void => {
      this._emitter.emit("breaker:state", event);
    };

    breaker.on("open", (event) => {
      this.logger.warn("Circuit breaker opened", {
        name: event.name,
        from: event.from,
        failures: event.failures,
      });
      forwardBreakerEvent(event);
    });

    breaker.on("closed", (event) => {
      this.logger.info("Circuit breaker closed", { name: event.name });
      forwardBreakerEvent(event);
    });

    breaker.on("half-open", (event) => {
      this.logger.info("Circuit breaker half-open — probing", {
        name: event.name,
      });
      forwardBreakerEvent(event);
    });

    return breaker;
  }
}

Object.defineProperty(ProteusSource, Symbol.for("ProteusSource"), { value: true });

const driverClassifiers: Record<string, CircuitBreakerOptions["classifier"]> = {
  postgres: classifyPostgresError,
  mysql: classifyMysqlError,
  redis: classifyRedisError,
  mongo: classifyMongoError,
};

const resolveDefaultClassifier = (driver: string): CircuitBreakerOptions["classifier"] =>
  driverClassifiers[driver];

const createMetadataResolver = (
  naming: NamingStrategy,
  getInheritanceMap: () => Map<Function, MetaInheritance> | undefined,
): { resolve: MetadataResolver; cache: Map<Function, EntityMetadata> | null } => {
  if (naming === "none") {
    return {
      resolve: (target) => getEntityMetadata(target, getInheritanceMap()),
      cache: null,
    };
  }

  const cache = new Map<Function, EntityMetadata>();

  return {
    resolve: (target): EntityMetadata => {
      let resolved = cache.get(target);
      if (!resolved) {
        resolved = applyNamingStrategy(
          getEntityMetadata(target, getInheritanceMap()),
          naming,
        );
        cache.set(target, resolved);
      }
      return resolved;
    },
    cache,
  };
};
