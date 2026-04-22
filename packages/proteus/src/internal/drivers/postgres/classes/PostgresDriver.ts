import type { IAmphora } from "@lindorm/amphora";
import type { ICircuitBreaker } from "@lindorm/breaker";
import { AbortError } from "@lindorm/errors";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { Client, Pool, type PoolClient } from "pg";
import type { IEntity, IProteusQueryBuilder } from "../../../../interfaces/index.js";
import type {
  IProteusDriver,
  TransactionHandle,
} from "../../../interfaces/ProteusDriver.js";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor.js";
import type {
  ProteusPostgresOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types/index.js";
import type { ProteusResult } from "../../../types/proteus-result.js";
import type {
  FilterRegistryGetter,
  MetadataResolver,
} from "../../../interfaces/ProteusDriver.js";
import type { EntityEmitFn } from "../../../../types/event-map.js";
import type { ProteusHookMeta } from "../../../../types/proteus-hook-meta.js";
import { BreakerExecutor } from "../../../classes/BreakerExecutor.js";
import { isPgQueryCancelledError, toAbortError } from "../utils/abort.js";
import { PostgresDriverError } from "../errors/PostgresDriverError.js";
import { PostgresMigrationError } from "../errors/PostgresMigrationError.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import type { PostgresTransactionHandle } from "../types/postgres-transaction-handle.js";
import { diffSchema } from "../utils/sync/diff-schema.js";
import { SyncPlanExecutor } from "../utils/sync/execute-sync-plan.js";
import { generateAppendOnlyDDL } from "../utils/ddl/generate-append-only-ddl.js";
import { introspectSchema } from "../utils/sync/introspect-schema.js";
import { projectDesiredSchema } from "../utils/sync/project-desired-schema.js";
import { quoteQualifiedName } from "../utils/quote-identifier.js";
import { beginTransaction } from "../utils/transaction/begin-transaction.js";
import { commitTransaction } from "../utils/transaction/commit-transaction.js";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction.js";
import { isRetryableTransactionError } from "../utils/transaction/is-retryable-transaction-error.js";
import { withRetry } from "../utils/transaction/with-retry.js";
import { MigrationManager } from "./MigrationManager.js";
import { PostgresExecutor } from "./PostgresExecutor.js";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder.js";
import type { RepositoryFactory } from "../../../types/repository-factory.js";
import type { FilterRegistry } from "../../../utils/query/filter-registry.js";
import { validateConnectionMutualExclusivity } from "../../../utils/validate-connection-options.js";
import {
  PostgresRepository,
  type CreateCursorClient,
  type WithImplicitTransaction,
} from "./PostgresRepository.js";
import { TransactionContext } from "./TransactionContext.js";

export class PostgresDriver implements IProteusDriver {
  private readonly options: ProteusPostgresOptions;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly emitEntity: EntityEmitFn;
  private readonly amphora: IAmphora | undefined;
  private readonly breaker: ICircuitBreaker | null;
  private readonly signal: AbortSignal | undefined;
  private pool: Pool | null = null;
  private connectingPromise: Promise<void> | null = null;

  public constructor(
    options: ProteusPostgresOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    emitEntity?: EntityEmitFn,
    amphora?: IAmphora,
    breaker?: ICircuitBreaker | null,
  ) {
    this.options = options;
    this.logger = logger.child(["PostgresDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? ((): FilterRegistry => new Map());
    this.emitEntity = emitEntity ?? (async (): Promise<void> => {});
    this.amphora = amphora;
    this.breaker = breaker ?? null;
    this.signal = undefined;
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

    const pool = new Pool({
      connectionString: this.options.url,
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
      min: this.options.pool?.min,
      max: this.options.pool?.max,
      connectionTimeoutMillis: this.options.pool?.connectionTimeoutMillis,
      idleTimeoutMillis: this.options.pool?.idleTimeoutMillis,
      maxUses: this.options.pool?.maxUses,
      ssl: this.options.ssl || undefined,
      application_name: this.options.applicationName,
      statement_timeout: this.options.statementTimeout,
      idle_in_transaction_session_timeout: this.options.idleTimeout,
    });

    pool.on("error", (err) => {
      this.logger.error("Idle pool client error", { error: err });
      this.breaker?.open();
    });

    // Verify connection before assigning — prevents pool leak on failure
    const client = await pool.connect();
    client.release();

    this.pool = pool;

    this.logger.debug("PostgreSQL connection pool created");
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

    this.logger.debug("PostgreSQL connection pool closed");
  }

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (this.options.synchronize && this.options.runMigrations) {
      throw new PostgresMigrationError(
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
    const pool = this.getPool();
    const result = await pool.query(sql, values);
    return {
      rows: result.rows as Array<R>,
      rowCount: result.rowCount ?? 0,
    };
  }

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: ProteusHookMeta,
  ): PostgresRepository<E> {
    const pool = this.getPool();
    const sessionSignal = this.signal;
    // Non-signal sessions hit the unchanged pool.query fast path (zero per-query
    // checkout). Signal-carrying sessions route through the acquire-per-query
    // cancel-aware path.
    const client = sessionSignal
      ? this.createPgClientFromPoolWithSignal(pool, sessionSignal)
      : this.createPgClientFromPool(pool);
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, context);

    // T2: Pool-backed — check out a dedicated PoolClient, build tx-scoped factory
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) => {
      if (sessionSignal?.aborted) {
        throw toAbortError(sessionSignal.reason);
      }
      const poolClient = await pool.connect();
      const disposeListener = sessionSignal
        ? this.attachPoolClientAbortListener(poolClient, sessionSignal)
        : null;
      const txClient = this.createPgClient(poolClient, sessionSignal);
      try {
        await txClient.query("BEGIN");
        const txExecutor = this.wrapExecutor(
          new PostgresExecutor<E>(
            txClient,
            metadata,
            namespace,
            this.getFilterRegistry(),
            this.amphora,
          ),
        );

        // Build tx-scoped repository factory via inline PostgresTransactionHandle
        const handle: PostgresTransactionHandle = {
          client: txClient,
          release: () => {}, // No-op — parent finally block owns poolClient.release()
          state: "active",
          savepointCounter: 0,
        };
        const txFactory: RepositoryFactory = <C extends IEntity>(
          t: Constructor<C>,
          p?: Constructor<IEntity>,
        ) => this.createTransactionalRepository(t, handle, p, context);

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
        poolClient.release();
      }
    };

    // C4: Cursor checks out a dedicated PoolClient for its lifetime.
    // When the session carries a signal, register an abort listener for the
    // cursor's span so an in-flight cursor read is cancelled server-side.
    const createCursorClient: CreateCursorClient = async () => {
      if (sessionSignal?.aborted) {
        throw toAbortError(sessionSignal.reason);
      }
      const poolClient = await pool.connect();
      const disposeListener = sessionSignal
        ? this.attachPoolClientAbortListener(poolClient, sessionSignal)
        : null;
      return {
        client: poolClient,
        release: () => {
          disposeListener?.();
          poolClient.release();
        },
      };
    };

    return new PostgresRepository<E>({
      target,
      executor: this.createExecutor(target),
      queryBuilderFactory: () => this.createQueryBuilder(target),
      client,
      namespace,
      logger: this.logger,
      context,
      parent,
      repositoryFactory: factory,
      withImplicitTransaction,
      createCursorClient,
      emitEntity: this.emitEntity,
      amphora: this.amphora,
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    context?: ProteusHookMeta,
  ): PostgresRepository<E> {
    const pgHandle = handle as PostgresTransactionHandle;
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);
    const txClient = pgHandle.client;
    const txExecutor = this.wrapExecutor(
      new PostgresExecutor<E>(
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
    ) => this.createTransactionalRepository(t, handle, p, context);

    // T3: Already in a transaction — passthrough with repositoryFactory
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) =>
      fn({ client: txClient, executor: txExecutor, repositoryFactory: factory });

    return new PostgresRepository<E>({
      target,
      executor: txExecutor,
      queryBuilderFactory: () => this.createTransactionalQueryBuilder(target, handle),
      client: txClient,
      namespace,
      logger: this.logger,
      context,
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
    const pool = this.getPool();
    const metadata = this.resolveMetadata(target);
    const client = this.signal
      ? this.createPgClientFromPoolWithSignal(pool, this.signal)
      : this.createPgClientFromPool(pool);
    return this.wrapExecutor(
      new PostgresExecutor<E>(
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
    const metadata = this.resolveMetadata(target);
    const pgHandle = handle as PostgresTransactionHandle;
    return this.wrapExecutor(
      new PostgresExecutor<E>(
        pgHandle.client,
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
    const pool = this.getPool();
    const metadata = this.resolveMetadata(target);
    const client = this.signal
      ? this.createPgClientFromPoolWithSignal(pool, this.signal)
      : this.createPgClientFromPool(pool);
    return new PostgresQueryBuilder<E>(metadata, client, this.namespace, this.logger);
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);
    const pgHandle = handle as PostgresTransactionHandle;
    return new PostgresQueryBuilder<E>(
      metadata,
      pgHandle.client,
      this.namespace,
      this.logger,
    );
  }

  public async acquireClient(): Promise<PoolClient> {
    return this.getPool().connect();
  }

  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    emitEntity: EntityEmitFn,
    signal?: AbortSignal,
  ): PostgresDriver {
    const cloned = Object.create(PostgresDriver.prototype) as PostgresDriver;
    (cloned as any).options = this.options;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    (cloned as any).getFilterRegistry = getFilterRegistry;
    (cloned as any).emitEntity = emitEntity;
    (cloned as any).amphora = this.amphora;
    (cloned as any).breaker = this.breaker;
    (cloned as any).pool = this.pool; // Share the same connection pool
    (cloned as any).signal = signal;
    (cloned as any).connectingPromise = null;
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
      (pc) => this.createPgClient(pc, signal),
      options?.isolation,
      signal
        ? { onAcquired: (pc) => this.attachPoolClientAbortListener(pc, signal) }
        : undefined,
    );
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    await commitTransaction(handle as PostgresTransactionHandle);
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    await rollbackTransaction(handle as PostgresTransactionHandle);
  }

  /**
   * Executes a callback within a transaction, with optional automatic retry.
   *
   * When retry is enabled, each retry checks out a new PoolClient from the pool.
   * Under high contention with many concurrent retrying transactions, the pool
   * could be temporarily exhausted. The pool's `connectionTimeoutMillis` handles
   * this gracefully by failing with a timeout rather than hanging indefinitely.
   */
  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    const effectiveSignal = this.signal;

    const attempt = async (): Promise<T> => {
      // Short-circuit between attempts on abort. The retry loop short-circuits
      // via isRetryable, but this also gates the first attempt.
      if (effectiveSignal?.aborted) {
        throw toAbortError(effectiveSignal.reason);
      }

      const pool = this.getPool();
      const handle = await beginTransaction(
        pool,
        (pc) => this.createPgClient(pc, effectiveSignal),
        options?.isolation,
        effectiveSignal
          ? {
              onAcquired: (pc) => this.attachPoolClientAbortListener(pc, effectiveSignal),
            }
          : undefined,
      );

      const repoFactory: RepositoryFactory = <C extends IEntity>(
        t: Constructor<C>,
        p?: Constructor<IEntity>,
      ) => this.createTransactionalRepository(t, handle, p);

      const ctx = new TransactionContext(
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
      } finally {
        if (handle.state === "active") {
          handle.release();
        }
      }
    };

    if (options?.retry) {
      const retryOptions = {
        ...options.retry,
        onRetry:
          options.retry.onRetry ??
          ((attempt: number, error: unknown): void => {
            this.logger.warn("Transaction retry", {
              attempt,
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
      throw new PostgresDriverError(
        "Not connected — call connect() before calling setup() or query()",
      );
    }
    return this.pool;
  }

  private wrapWithQueryClient(
    queryFn: (
      sql: string,
      params?: Array<unknown>,
    ) => Promise<{ rows: Array<any>; rowCount: number | null }>,
  ): PostgresQueryClient {
    return {
      query: async <R = Record<string, unknown>>(
        sql: string,
        params?: Array<unknown>,
      ): Promise<{ rows: Array<R>; rowCount: number }> => {
        const start = this.options.slowQueryThresholdMs ? performance.now() : 0;
        const result = await queryFn(sql, params);

        // Note: for pool-backed clients, elapsed time includes pool checkout wait
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

        return {
          rows: result.rows as Array<R>,
          rowCount: result.rowCount ?? 0,
        };
      },
    };
  }

  private createPgClient(
    poolClient: PoolClient,
    signal?: AbortSignal,
  ): PostgresQueryClient {
    if (!signal) {
      return this.wrapWithQueryClient((sql, params) => poolClient.query(sql, params));
    }

    // Signal-aware: rewrap server-side cancel rejections (57014) as
    // AbortError, but never pre-emptively reject queries. The abort listener
    // that actually issues pg_cancel_backend is owned by the caller
    // (withImplicitTransaction / withTransaction / beginTransaction) so it
    // is tied to the PoolClient's lifetime, not the query's. This lets
    // ROLLBACK still run on the same client after a cancel.
    return this.wrapWithQueryClient(async (sql, params) => {
      try {
        return await poolClient.query(sql, params);
      } catch (err) {
        if (isPgQueryCancelledError(err)) {
          throw toAbortError(signal.reason, err);
        }
        throw err;
      }
    });
  }

  /**
   * Attach an abort listener to a PoolClient so an abort on `signal` triggers
   * `pg_cancel_backend(processID)` once. Returns a `dispose` function that
   * removes the listener — call it when the PoolClient is released back to
   * the pool.
   */
  private attachPoolClientAbortListener(
    poolClient: PoolClient,
    signal: AbortSignal,
  ): () => void {
    // processID is set on PoolClient after handshake but is not declared
    // on the @types/pg PoolClient interface. See pg/lib/client.js:341.
    const pid = (poolClient as unknown as { processID: number | null }).processID;
    const onAbort = (): void => {
      if (pid != null) void this.issueCancel(pid);
    };
    signal.addEventListener("abort", onAbort, { once: true });
    return () => signal.removeEventListener("abort", onAbort);
  }

  private createPgClientFromPool(pool: Pool): PostgresQueryClient {
    return this.wrapWithQueryClient((sql, params) => pool.query(sql, params));
  }

  /**
   * Signal-aware executor path. Each query acquires a dedicated PoolClient
   * so it has a known `processID`, registers an abort listener that issues
   * `pg_cancel_backend`, runs the query, and releases the client. Adds one
   * pool checkout per query relative to the non-signal path — only used
   * when a session signal is present.
   */
  private createPgClientFromPoolWithSignal(
    pool: Pool,
    signal: AbortSignal,
  ): PostgresQueryClient {
    return this.wrapWithQueryClient(async (sql, params) => {
      if (signal.aborted) {
        throw toAbortError(signal.reason);
      }

      const pc = await pool.connect();
      // processID is set on PoolClient after handshake but is not declared
      // on the @types/pg PoolClient interface. See pg/lib/client.js:341.
      const pid = (pc as unknown as { processID: number | null }).processID;
      const onAbort = (): void => {
        if (pid != null) void this.issueCancel(pid);
      };
      signal.addEventListener("abort", onAbort, { once: true });

      try {
        return await pc.query(sql, params);
      } catch (err) {
        if (isPgQueryCancelledError(err) || signal.aborted) {
          throw toAbortError(signal.reason, err);
        }
        throw err;
      } finally {
        signal.removeEventListener("abort", onAbort);
        pc.release();
      }
    });
  }

  /**
   * Issue a `pg_cancel_backend` against the given processID on a throwaway
   * pg.Client. Best-effort: failures are logged but not propagated, since
   * the caller already has its own rejection path.
   */
  private async issueCancel(processID: number): Promise<void> {
    const cancelClient = new Client({
      connectionString: this.options.url,
      host: this.options.host,
      port: this.options.port,
      user: this.options.user,
      password: this.options.password,
      database: this.options.database,
      ssl: this.options.ssl || undefined,
      application_name: this.options.applicationName,
    });

    try {
      await cancelClient.connect();
      await cancelClient.query("SELECT pg_cancel_backend($1)", [processID]);
    } catch (err) {
      this.logger.warn("Failed to issue pg_cancel_backend", {
        error: err instanceof Error ? err.message : String(err),
        processID,
      });
    } finally {
      try {
        await cancelClient.end();
      } catch {
        /* best effort */
      }
    }
  }

  private async synchronize(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (!this.options.synchronize) return;

    this.logger.warn(
      "Synchronize mode is enabled. This is intended for development only. Running in production will result in data loss.",
    );

    const pool = this.getPool();
    const nsOptions = { namespace: this.namespace };

    // Collect metadata for all registered entities (with naming strategy applied)
    const metadatas = entities.map((e) => this.resolveMetadata(e));

    // Project desired schema from entity metadata
    const desired = projectDesiredSchema(metadatas, nsOptions);

    // Derive managed tables from desired schema — includes join tables (#7)
    const managedTables = desired.tables.map((t) => ({ schema: t.schema, name: t.name }));

    // Check out a dedicated connection for the entire sync operation.
    // Advisory locks and transactions are session-scoped — using pool.query()
    // would dispatch each statement to a random connection, breaking both.
    const poolClient = await pool.connect();

    try {
      const client = this.createPgClient(poolClient);

      // Introspect current database state
      const snapshot = await introspectSchema(client, managedTables);

      // Diff and execute
      const plan = diffSchema(snapshot, desired);
      const dryRun = this.options.synchronize === "dry-run";

      const result = await new SyncPlanExecutor(this.logger, this.namespace).execute(
        client,
        plan,
        { dryRun },
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
        await this.syncAppendOnlyTriggers(client, metadatas, nsOptions);
      }
    } finally {
      poolClient.release();
    }
  }

  private async syncAppendOnlyTriggers(
    client: PostgresQueryClient,
    metadatas: Array<import("../../../entity/types/metadata.js").EntityMetadata>,
    nsOptions: { namespace: string | null },
  ): Promise<void> {
    for (const metadata of metadatas) {
      const tableName = metadata.entity.name;
      const namespace = metadata.entity.namespace || nsOptions.namespace;
      const qualifiedTable = quoteQualifiedName(namespace, tableName);

      if (metadata.appendOnly) {
        try {
          const statements = generateAppendOnlyDDL(tableName, namespace);

          for (const sql of statements) {
            await client.query(sql);
          }

          this.logger.debug("Applied append-only triggers", {
            table: qualifiedTable,
          });
        } catch (error) {
          this.logger.warn("Failed to apply append-only triggers", {
            table: qualifiedTable,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      } else {
        // Drop any existing append-only triggers in case @AppendOnly was removed
        try {
          for (const op of ["update", "delete", "truncate"] as const) {
            await client.query(
              `DROP TRIGGER IF EXISTS "proteus_append_only_no_${op}" ON ${qualifiedTable};`,
            );
          }
        } catch {
          // Best effort — table may not exist yet during first sync
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
    const poolClient = await pool.connect();

    try {
      const client = this.createPgClient(poolClient);

      const tableOptions = this.options.migrationsTable
        ? { table: this.options.migrationsTable }
        : undefined;

      for (const directory of directories) {
        const manager = new MigrationManager({
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
      poolClient.release();
    }
  }
}
