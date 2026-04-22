import type { ICircuitBreaker } from "@lindorm/breaker";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { Pool, PoolConnection } from "mysql2/promise";
import type { IEntity, IProteusQueryBuilder } from "../../../../interfaces/index.js";
import type {
  IProteusDriver,
  TransactionHandle,
} from "../../../interfaces/ProteusDriver.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type {
  ProteusMysqlOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types/index.js";
import type { ProteusResult } from "../../../types/proteus-result.js";
import type { IAmphora } from "@lindorm/amphora";
import type {
  FilterRegistryGetter,
  MetadataResolver,
} from "../../../interfaces/ProteusDriver.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { ProteusHookMeta } from "../../../../types/proteus-hook-meta.js";
import type { IProteusRepository } from "../../../../interfaces/ProteusRepository.js";
import { MySqlDriverError } from "../errors/MySqlDriverError.js";
import { MySqlMigrationError } from "../errors/MySqlMigrationError.js";
import type { MysqlQueryClient } from "../types/mysql-query-client.js";
import type { MysqlTransactionHandle } from "../types/mysql-transaction-handle.js";
import { beginTransaction } from "../utils/transaction/begin-transaction.js";
import { commitTransaction } from "../utils/transaction/commit-transaction.js";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction.js";
import { isRetryableTransactionError } from "../utils/transaction/is-retryable-transaction-error.js";
import { MySqlTransactionContext } from "./MySqlTransactionContext.js";
import { MySqlExecutor } from "./MySqlExecutor.js";
import { MySqlRepository, type WithImplicitTransaction } from "./MySqlRepository.js";
import { generateAppendOnlyDDL } from "../utils/ddl/generate-append-only-ddl.js";
import { introspectSchema } from "../utils/sync/introspect-schema.js";
import { projectDesiredSchemaMysql } from "../utils/sync/project-desired-schema-mysql.js";
import { diffSchema } from "../utils/sync/diff-schema.js";
import { SyncPlanExecutor } from "../utils/sync/execute-sync-plan.js";
import { quoteIdentifier } from "../utils/quote-identifier.js";
import { buildMysqlLockName } from "../../../utils/advisory-lock-name.js";
import { MySqlMigrationManager } from "./MySqlMigrationManager.js";
import { MySqlQueryBuilder } from "./MySqlQueryBuilder.js";
import { AbortError } from "@lindorm/errors";
import { BreakerExecutor } from "../../../classes/BreakerExecutor.js";
import { validateConnectionMutualExclusivity } from "../../../utils/validate-connection-options.js";
import { isMysqlQueryInterruptedError, toAbortError } from "../utils/abort.js";

export class MySqlDriver implements IProteusDriver {
  private readonly options: ProteusMysqlOptions;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly emitEntity: EntityEmitFn;
  private readonly amphora: IAmphora | undefined;
  private readonly breaker: ICircuitBreaker | null;
  private pool: Pool | null = null;
  private connectingPromise: Promise<void> | null = null;
  private signal: AbortSignal | undefined;

  public constructor(
    options: ProteusMysqlOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    emitEntity?: EntityEmitFn,
    amphora?: IAmphora,
    breaker?: ICircuitBreaker | null,
  ) {
    this.options = options;
    this.logger = logger.child(["MySqlDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? ((): FilterRegistry => new Map());
    this.emitEntity = emitEntity ?? (async (): Promise<void> => {});
    this.amphora = amphora;
    this.breaker = breaker ?? null;
  }

  public async connect(): Promise<void> {
    if (this.pool) return;
    if (this.connectingPromise) return this.connectingPromise;

    this.connectingPromise = this.doConnect().finally(() => {
      this.connectingPromise = null;
    });
    return this.connectingPromise;
  }

  private async doConnect(): Promise<void> {
    if (this.pool) return;

    validateConnectionMutualExclusivity(this.options);

    const mysql = await import("mysql2/promise");

    // Shared pool behaviour options (independent of connection method)
    const sharedOptions: Record<string, unknown> = {
      connectionLimit: this.options.pool?.max ?? 10,
      waitForConnections: true,
      supportBigNumbers: true,
      bigNumberStrings: false,
      timezone: "+00:00",
      typeCast: true,
      rowsAsArray: false,
    };

    // mysql2 pool options that map from our config
    if (this.options.pool?.connectionTimeoutMillis != null) {
      sharedOptions.connectTimeout = this.options.pool.connectionTimeoutMillis;
    }
    if (this.options.pool?.min != null) {
      // mysql2 has no minIdle, but maxIdle controls idle connection count.
      // Setting maxIdle = min keeps at least that many idle connections available.
      sharedOptions.maxIdle = this.options.pool.min;
    }
    if (this.options.pool?.queueLimit != null) {
      sharedOptions.queueLimit = this.options.pool.queueLimit;
    }
    if (this.options.ssl != null) {
      sharedOptions.ssl = this.options.ssl;
    }
    if (this.options.charset != null) {
      sharedOptions.charset = this.options.charset;
    }
    if (this.options.compress) {
      sharedOptions.compress = true;
    }

    // When `url` is provided, use it exclusively for connection params.
    // When absent, use individual host/port/user/password/database.
    const connectionOptions: Record<string, unknown> = this.options.url
      ? { uri: this.options.url }
      : {
          host: this.options.host ?? "localhost",
          port: this.options.port ?? 3306,
          user: this.options.user,
          password: this.options.password,
          database: this.options.database ?? this.options.namespace ?? undefined,
        };

    const pool = mysql.createPool({
      ...connectionOptions,
      ...sharedOptions,
    } as any);

    // Verify connection before assigning — prevents pool leak on failure
    const connection = await pool.getConnection();
    connection.release();

    // Prevent Node.js unhandled EventEmitter crashes when idle connections drop
    // mysql2's Pool type definition does not expose .on() for the "error" event,
    // but the underlying EventEmitter supports it at runtime.
    (pool as unknown as import("events").EventEmitter).on("error", (err: Error) => {
      this.logger.error(err);
      this.breaker?.open();
    });

    this.pool = pool;

    this.logger.debug("MySQL connection pool created");
  }

  public async ping(): Promise<boolean> {
    try {
      const pool = this.getPool();
      await pool.query("SELECT 1");
      return true;
    } catch {
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.pool) return;

    const p = this.pool;
    this.pool = null;
    try {
      await p.end();
    } catch {
      /* already disconnected */
    }

    this.logger.debug("MySQL connection pool closed");
  }

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (this.options.synchronize && this.options.runMigrations) {
      throw new MySqlMigrationError(
        "synchronize and runMigrations are mutually exclusive — use one or the other",
      );
    }

    // Auto-connect if not already connected
    if (!this.pool) {
      await this.connect();
    }

    if (this.options.runMigrations) {
      await this.runMigrations();
    } else if (this.options.synchronize) {
      await this.synchronize(entities);
    }
  }

  public async query<R = unknown>(
    sql: string,
    values?: Array<unknown>,
  ): Promise<ProteusResult<R>> {
    this.checkSignal();
    const pool = this.getPool();
    const client = this.signal
      ? this.createMysqlClientFromPoolWithSignal(pool, this.signal)
      : this.createMysqlClientFromPool(pool);

    const result = await client.query<R>(sql, values);
    return {
      rows: result.rows,
      rowCount: result.rowCount,
    };
  }

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    meta?: ProteusHookMeta,
  ): IProteusRepository<E> {
    this.checkSignal();
    const pool = this.getPool();
    const sessionSignal = this.signal;
    const client = sessionSignal
      ? this.createMysqlClientFromPoolWithSignal(pool, sessionSignal)
      : this.createMysqlClientFromPool(pool);
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, meta);

    // T2: Pool-backed — check out a dedicated PoolConnection, build tx-scoped factory
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) => {
      if (sessionSignal?.aborted) {
        throw toAbortError(sessionSignal.reason);
      }
      const connection = await pool.getConnection();
      const disposeListener = sessionSignal
        ? this.attachConnectionAbortListener(connection, sessionSignal)
        : null;
      const txClient = this.createMysqlClient(connection, sessionSignal);
      try {
        await txClient.query("START TRANSACTION");
        const txExecutor = this.wrapExecutor(
          new MySqlExecutor<E>(
            txClient,
            metadata,
            namespace,
            this.getFilterRegistry(),
            this.amphora,
          ),
        );

        // Build tx-scoped repository factory via inline MysqlTransactionHandle
        const handle: MysqlTransactionHandle = {
          client: txClient,
          connection, // PoolConnection — kept for savepoint support
          release: () => {}, // No-op — parent finally block owns connection.release()
          state: "active",
          savepointCounter: 0,
        };
        const txFactory: RepositoryFactory = <C extends IEntity>(
          t: Constructor<C>,
          p?: Constructor<IEntity>,
        ) => this.createTransactionalRepository(t, handle, p, meta);

        const result = await fn({
          client: txClient,
          executor: txExecutor,
          repositoryFactory: txFactory,
        });
        await txClient.query("COMMIT");
        return result;
      } catch (error) {
        try {
          await txClient.query("ROLLBACK");
        } catch {
          // Already rolled back or connection lost
        }
        throw error;
      } finally {
        disposeListener?.();
        connection.release();
      }
    };

    return new MySqlRepository<E>({
      target,
      executor: this.createExecutor(target),
      queryBuilderFactory: () => this.createQueryBuilder(target),
      client,
      namespace,
      logger: this.logger,
      meta,
      parent,
      repositoryFactory: factory,
      withImplicitTransaction,
      emitEntity: this.emitEntity,
      amphora: this.amphora,
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    meta?: ProteusHookMeta,
  ): IProteusRepository<E> {
    this.checkSignal();
    const mysqlHandle = handle as MysqlTransactionHandle;
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);
    const txClient = mysqlHandle.client;
    const txExecutor = this.wrapExecutor(
      new MySqlExecutor<E>(
        txClient,
        metadata,
        namespace,
        this.getFilterRegistry(),
        this.amphora,
      ),
    );

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p, meta);

    // T3: Already in a transaction — passthrough with repositoryFactory
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) =>
      fn({ client: txClient, executor: txExecutor, repositoryFactory: factory });

    return new MySqlRepository<E>({
      target,
      executor: txExecutor,
      queryBuilderFactory: () => this.createTransactionalQueryBuilder(target, handle),
      client: txClient,
      namespace,
      logger: this.logger,
      meta,
      parent,
      repositoryFactory: factory,
      withImplicitTransaction,
      emitEntity: this.emitEntity,
      amphora: this.amphora,
    });
  }

  public createExecutor<E extends IEntity>(
    target: Constructor<E>,
  ): IRepositoryExecutor<E> {
    this.checkSignal();
    const pool = this.getPool();
    const metadata = this.resolveMetadata(target);
    const client = this.signal
      ? this.createMysqlClientFromPoolWithSignal(pool, this.signal)
      : this.createMysqlClientFromPool(pool);
    return this.wrapExecutor(
      new MySqlExecutor<E>(
        client,
        metadata,
        this.namespace,
        this.getFilterRegistry(),
        this.amphora,
      ),
    );
  }

  public createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IRepositoryExecutor<E> {
    this.checkSignal();
    const metadata = this.resolveMetadata(target);
    const mysqlHandle = handle as MysqlTransactionHandle;
    return this.wrapExecutor(
      new MySqlExecutor<E>(
        mysqlHandle.client,
        metadata,
        this.namespace,
        this.getFilterRegistry(),
        this.amphora,
      ),
    );
  }

  public createQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    this.checkSignal();
    const pool = this.getPool();
    const metadata = this.resolveMetadata(target);
    const client = this.signal
      ? this.createMysqlClientFromPoolWithSignal(pool, this.signal)
      : this.createMysqlClientFromPool(pool);
    return new MySqlQueryBuilder<E>(metadata, client, this.namespace, this.logger);
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    this.checkSignal();
    const metadata = this.resolveMetadata(target);
    const mysqlHandle = handle as MysqlTransactionHandle;
    return new MySqlQueryBuilder<E>(
      metadata,
      mysqlHandle.client,
      this.namespace,
      this.logger,
    );
  }

  public async acquireClient(): Promise<PoolConnection> {
    return this.getPool().getConnection();
  }

  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    emitEntity: EntityEmitFn,
    signal?: AbortSignal,
  ): MySqlDriver {
    const cloned = Object.create(MySqlDriver.prototype) as MySqlDriver;
    (cloned as any).options = this.options;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    // Use the caller-supplied getters (not this.getFilterRegistry / this.emitEntity)
    // so the clone reads from the cloned source's ref cells.
    (cloned as any).getFilterRegistry = getFilterRegistry ?? this.getFilterRegistry;
    (cloned as any).emitEntity = emitEntity ?? this.emitEntity;
    (cloned as any).amphora = this.amphora;
    (cloned as any).breaker = this.breaker;
    (cloned as any).pool = this.pool; // Share the same connection pool
    (cloned as any).connectingPromise = null;
    // When a signal is attached, the executor / repository routes through a
    // signal-aware query path: acquire a dedicated PoolConnection per query
    // (so threadId is stable), attach an abort listener that fires
    // KILL QUERY <threadId> via a throwaway mysql2.createConnection(), and
    // release the PoolConnection in finally. Non-signal sessions keep the
    // existing pool.query fast path.
    (cloned as any).signal = signal;
    return cloned;
  }

  public async beginTransaction(
    options?: TransactionOptions,
  ): Promise<TransactionHandle> {
    const pool = this.getPool();
    const signal = this.signal;
    if (signal?.aborted) {
      throw toAbortError(signal.reason);
    }
    return beginTransaction(
      pool,
      (conn: PoolConnection) => this.createMysqlClient(conn, signal),
      options?.isolation,
      signal
        ? { onAcquired: (conn) => this.attachConnectionAbortListener(conn, signal) }
        : undefined,
    );
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    await commitTransaction(handle as MysqlTransactionHandle);
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    await rollbackTransaction(handle as MysqlTransactionHandle);
  }

  /**
   * Executes a callback within a transaction, with optional automatic retry.
   *
   * When retry is enabled, each retry checks out a new PoolConnection from the pool.
   * Under high contention with many concurrent retrying transactions, the pool
   * could be temporarily exhausted. The pool's `connectionLimit` and `waitForConnections`
   * handle this gracefully.
   */
  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const effectiveSignal = this.signal;

    const attempt = async (): Promise<T> => {
      // Short-circuit on abort between attempts so retries stop once the
      // session has been cancelled.
      if (effectiveSignal?.aborted) {
        throw toAbortError(effectiveSignal.reason);
      }

      const pool = this.getPool();
      const handle = await beginTransaction(
        pool,
        (conn: PoolConnection) => this.createMysqlClient(conn, effectiveSignal),
        options?.isolation,
        effectiveSignal
          ? {
              onAcquired: (conn) =>
                this.attachConnectionAbortListener(conn, effectiveSignal),
            }
          : undefined,
      );

      try {
        const repoFactory: RepositoryFactory = <C extends IEntity>(
          t: Constructor<C>,
          p?: Constructor<IEntity>,
        ) => this.createTransactionalRepository(t, handle, p);

        const ctx = new MySqlTransactionContext(
          handle,
          this.namespace,
          this.logger,
          repoFactory,
        );

        try {
          const result = await callback(ctx);

          if (handle.state === "active") {
            await commitTransaction(handle);
          }

          return result;
        } catch (error) {
          if (handle.state === "active") {
            try {
              await rollbackTransaction(handle);
            } catch {
              // Swallow rollback error — preserve the original error for retry logic
            }
          }

          throw error;
        }
      } finally {
        // Safety net: if neither commit nor rollback ran (e.g. MySqlTransactionContext
        // construction threw), release the connection to prevent pool leaks.
        // commitTransaction and rollbackTransaction already release, so only act
        // when the handle is still active.
        if (handle.state === "active") {
          handle.release();
        }
      }
    };

    if (options?.retry) {
      const { withRetry } = await import("../../../utils/transaction/with-retry.js");

      const retryOptions = {
        ...options.retry,
        onRetry:
          options.retry.onRetry ??
          ((attemptNum: number, error: unknown): void => {
            this.logger.warn("Transaction retry", {
              attempt: attemptNum,
              error: error instanceof Error ? error.message : String(error),
            });
          }),
      };
      // Abort is terminal: never retry an AbortError, and never retry after
      // the signal has been aborted.
      const isRetryable = (error: unknown): boolean => {
        if (error instanceof AbortError) return false;
        if (effectiveSignal?.aborted) return false;
        return isRetryableTransactionError(error);
      };
      return withRetry(attempt, isRetryable, retryOptions);
    }

    return attempt();
  }

  // Private

  private wrapExecutor<E extends IEntity>(
    executor: IRepositoryExecutor<E>,
  ): IRepositoryExecutor<E> {
    return this.breaker ? new BreakerExecutor(executor, this.breaker) : executor;
  }

  private getPool(): Pool {
    if (!this.pool) {
      throw new MySqlDriverError(
        "Not connected — call connect() before calling setup() or query()",
      );
    }
    return this.pool;
  }

  private wrapWithQueryClient(
    queryFn: (sql: string, params?: Array<unknown>) => Promise<[Array<any>, any]>,
  ): MysqlQueryClient {
    return {
      query: async <R = Record<string, unknown>>(
        sql: string,
        params?: Array<unknown>,
      ): Promise<{ rows: Array<R>; rowCount: number; insertId: number }> => {
        const start = this.options.slowQueryThresholdMs ? performance.now() : 0;
        const [rows] = await queryFn(sql, params);

        if (this.options.slowQueryThresholdMs) {
          const elapsed = performance.now() - start;
          if (elapsed > this.options.slowQueryThresholdMs) {
            this.logger.warn("Slow query detected", {
              sql: sql.slice(0, 200),
              elapsed: Math.round(elapsed),
              threshold: this.options.slowQueryThresholdMs,
            });
          }
        }

        // For SELECT statements, rows is an array of objects.
        // For INSERT/UPDATE/DELETE, rows is a ResultSetHeader with affectedRows etc.
        if (Array.isArray(rows)) {
          return {
            rows: rows as Array<R>,
            rowCount: rows.length,
            insertId: 0,
          };
        }

        // ResultSetHeader (INSERT/UPDATE/DELETE)
        return {
          rows: [] as Array<R>,
          rowCount: (rows as any).affectedRows ?? 0,
          insertId: Number((rows as any).insertId ?? 0),
        };
      },
    };
  }

  private createMysqlClient(
    connection: PoolConnection,
    signal?: AbortSignal,
  ): MysqlQueryClient {
    if (!signal) {
      return this.wrapWithQueryClient(
        (sql, params) => connection.query(sql, params) as Promise<[Array<any>, any]>,
      );
    }

    // Signal-aware: rewrap ER_QUERY_INTERRUPTED (1317) as AbortError. The
    // abort listener that fires KILL QUERY is owned by the caller
    // (withImplicitTransaction / beginTransaction / withTransaction) so it
    // is bound to the PoolConnection's lifetime rather than a single query.
    // That keeps ROLLBACK runnable on the same connection after a kill.
    //
    // We do NOT pre-emptively reject queries here — ROLLBACK still needs to
    // run on the same connection after a cancel to leave the pool healthy.
    return this.wrapWithQueryClient(async (sql, params) => {
      try {
        return (await connection.query(sql, params)) as [Array<any>, any];
      } catch (err) {
        if (isMysqlQueryInterruptedError(err)) {
          throw toAbortError(signal.reason, err);
        }
        throw err;
      }
    });
  }

  private createMysqlClientFromPool(pool: Pool): MysqlQueryClient {
    return this.wrapWithQueryClient(
      (sql, params) => pool.query(sql, params) as Promise<[Array<any>, any]>,
    );
  }

  /**
   * Signal-aware executor path. Each query acquires a dedicated PoolConnection
   * so it has a known `threadId`, registers an abort listener that issues
   * KILL QUERY on another session, runs the query, and releases the
   * connection. Adds one pool checkout per query relative to the non-signal
   * path — only used when a session signal is present.
   */
  private createMysqlClientFromPoolWithSignal(
    pool: Pool,
    signal: AbortSignal,
  ): MysqlQueryClient {
    return this.wrapWithQueryClient(async (sql, params) => {
      if (signal.aborted) {
        throw toAbortError(signal.reason);
      }

      const conn = await pool.getConnection();
      const tid = (conn as unknown as { threadId: number | null }).threadId;
      const onAbort = (): void => {
        if (tid != null) void this.issueKillQuery(tid);
      };
      signal.addEventListener("abort", onAbort, { once: true });

      try {
        const result = (await conn.query(sql, params)) as [Array<any>, any];
        // mysql behaves differently to pg here: a successful KILL QUERY of
        // `SELECT SLEEP(n)` returns a row instead of rejecting with
        // ER_QUERY_INTERRUPTED. If the signal aborted while this query was
        // in-flight, treat the result as a cancelled outcome regardless of
        // whether mysql returned rows — the caller already unwound.
        if (signal.aborted) {
          throw toAbortError(signal.reason);
        }
        return result;
      } catch (err) {
        if (isMysqlQueryInterruptedError(err) || signal.aborted) {
          throw toAbortError(signal.reason, err);
        }
        throw err;
      } finally {
        signal.removeEventListener("abort", onAbort);
        conn.release();
      }
    });
  }

  /**
   * Attach an abort listener to a PoolConnection so an abort on `signal`
   * fires `KILL QUERY <threadId>` once. Returns a `dispose` function that
   * removes the listener — call it when the PoolConnection is released.
   */
  private attachConnectionAbortListener(
    connection: PoolConnection,
    signal: AbortSignal,
  ): () => void {
    const tid = (connection as unknown as { threadId: number | null }).threadId;
    const onAbort = (): void => {
      if (tid != null) void this.issueKillQuery(tid);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }

  /**
   * Issue `KILL QUERY <threadId>` against the given threadId on a throwaway
   * mysql2 connection. Best-effort: failures are logged but not propagated
   * since the caller already has its own rejection path.
   */
  private async issueKillQuery(threadId: number): Promise<void> {
    const mysql = await import("mysql2/promise");
    const conn = await mysql.createConnection({
      ...(this.options.url
        ? { uri: this.options.url }
        : {
            host: this.options.host ?? "localhost",
            port: this.options.port ?? 3306,
            user: this.options.user,
            password: this.options.password,
            database: this.options.database ?? this.options.namespace ?? undefined,
          }),
      ssl: this.options.ssl as any,
    } as any);

    try {
      await conn.query("KILL QUERY ?", [threadId]);
    } catch (err) {
      this.logger.warn("Failed to issue KILL QUERY", {
        error: err instanceof Error ? err.message : String(err),
        threadId,
      });
    } finally {
      try {
        await conn.end();
      } catch {
        /* best effort */
      }
    }
  }

  private checkSignal(): void {
    if (this.signal?.aborted) {
      throw toAbortError(this.signal.reason);
    }
  }

  private async synchronize(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (!this.options.synchronize) return;

    this.logger.warn(
      "Synchronize mode is enabled. This is intended for development only. Running in production will result in data loss.",
    );

    const pool = this.getPool();
    const nsOptions = { namespace: this.namespace };

    const metadatas = entities.map((e) => this.resolveMetadata(e));

    const desired = projectDesiredSchemaMysql(metadatas, nsOptions);

    const managedTableNames = desired.tables.map((t) => t.name);

    // Use a dedicated connection for the entire sync operation.
    // Advisory locks are session-scoped — using pool.query() would dispatch
    // each statement to a random connection, breaking the lock.
    const connection = await pool.getConnection();

    try {
      const client = this.createMysqlClient(connection);

      // Acquire advisory lock BEFORE introspect+diff to prevent concurrent
      // sync processes from computing identical diffs and both executing.
      const syncLockName = buildMysqlLockName("proteus_sync", this.namespace);
      const { rows: lockRows } = await client.query<{ lock_result: number | null }>(
        `SELECT GET_LOCK(?, 30) AS lock_result`,
        [syncLockName],
      );
      if (lockRows[0]?.lock_result !== 1) {
        throw new MySqlDriverError(
          "Could not acquire sync advisory lock — another sync process is running",
        );
      }

      try {
        const snapshot = await introspectSchema(client, managedTableNames);

        const plan = diffSchema(snapshot, desired);
        const dryRun = this.options.synchronize === "dry-run";

        // Pass skipLock so SyncPlanExecutor does not double-acquire the advisory lock
        const result = await new SyncPlanExecutor(this.logger, this.namespace).execute(
          client,
          plan,
          { dryRun, skipLock: true },
        );

        if (dryRun) {
          this.logger.info(
            `Dry-run sync complete: ${plan.operations.length} operations planned`,
          );
        } else {
          this.logger.info(
            `Sync complete: ${result.statementsExecuted} statements executed`,
          );
        }

        // Post-sync: apply or remove append-only triggers
        if (!dryRun) {
          await this.syncAppendOnlyTriggers(client, metadatas);
        }
      } finally {
        try {
          await client.query(`SELECT RELEASE_LOCK(?)`, [syncLockName]);
        } catch {
          // Best effort — lock will expire on session close
        }
      }
    } finally {
      connection.release();
    }
  }

  private async syncAppendOnlyTriggers(
    client: MysqlQueryClient,
    metadatas: Array<import("../../../entity/types/metadata.js").EntityMetadata>,
  ): Promise<void> {
    for (const metadata of metadatas) {
      const tableName = metadata.entity.name;
      const quotedTable = quoteIdentifier(tableName);

      if (metadata.appendOnly) {
        try {
          const statements = generateAppendOnlyDDL(tableName);

          for (const sql of statements) {
            await client.query(sql);
          }

          this.logger.debug("Applied append-only triggers", {
            table: quotedTable,
          });
        } catch (error) {
          this.logger.warn("Failed to apply append-only triggers", {
            table: quotedTable,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        // Drop any existing append-only triggers in case @AppendOnly was removed
        try {
          for (const op of ["update", "delete"] as const) {
            await client.query(
              `DROP TRIGGER IF EXISTS ${quoteIdentifier(`proteus_ao_${tableName}_no_${op}`)};`,
            );
          }
        } catch {
          // Best effort — triggers may not exist
        }
      }
    }
  }

  private async runMigrations(): Promise<void> {
    const directories = this.options.migrations ?? [];

    if (directories.length === 0) {
      this.logger.debug("No migration directories configured — skipping");
      return;
    }

    const pool = this.getPool();
    const connection = await pool.getConnection();

    try {
      const client = this.createMysqlClient(connection);

      const tableOptions = this.options.migrationsTable
        ? { table: this.options.migrationsTable }
        : undefined;

      for (const directory of directories) {
        const manager = new MySqlMigrationManager({
          client,
          directory,
          logger: this.logger,
          namespace: this.namespace,
          tableOptions,
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
    } finally {
      connection.release();
    }
  }
}
