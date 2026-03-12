import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IEntity, IProteusQueryBuilder } from "../../../../interfaces";
import type {
  IProteusDriver,
  TransactionHandle,
} from "../../../interfaces/ProteusDriver";
import type { IRepositoryExecutor } from "../../../interfaces/RepositoryExecutor";
import type {
  ProteusSqliteOptions,
  TransactionCallback,
  TransactionOptions,
} from "../../../../types";
import type { ProteusResult } from "../../../types/proteus-result";
import type { IAmphora } from "@lindorm/amphora";
import type {
  FilterRegistryGetter,
  MetadataResolver,
  SubscriberRegistryGetter,
} from "#internal/interfaces/ProteusDriver";
import { SqliteDriverError } from "../errors/SqliteDriverError";
import { SqliteMigrationError } from "../errors/SqliteMigrationError";
import type { SqliteQueryClient } from "../types/sqlite-query-client";
import type { SqliteTransactionHandle } from "../types/sqlite-transaction-handle";
import { diffSchema } from "../utils/sync/diff-schema";
import { SyncPlanExecutor } from "../utils/sync/execute-sync-plan";
import { introspectSchema } from "../utils/sync/introspect-schema";
import { projectDesiredSchemaSqlite as projectDesiredSchema } from "../utils/sync/project-desired-schema-sqlite";
import { beginTransaction } from "../utils/transaction/begin-transaction";
import { commitTransaction } from "../utils/transaction/commit-transaction";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction";
import { SqliteMigrationManager } from "./SqliteMigrationManager";
import { SqliteExecutor } from "./SqliteExecutor";
import { SqliteQueryBuilder } from "./SqliteQueryBuilder";
import type { RepositoryFactory } from "#internal/types/repository-factory";
import { SqliteRepository, type WithImplicitTransaction } from "./SqliteRepository";
import { SqliteTransactionContext } from "./SqliteTransactionContext";

export class SqliteDriver implements IProteusDriver {
  private readonly options: ProteusSqliteOptions;
  private readonly logger: ILogger;
  private readonly namespace: string | null;
  private readonly resolveMetadata: MetadataResolver;
  private readonly getFilterRegistry: FilterRegistryGetter;
  private readonly getSubscribers: SubscriberRegistryGetter;
  private readonly amphora: IAmphora | undefined;
  private db: SqliteQueryClient | null = null;

  public constructor(
    options: ProteusSqliteOptions,
    logger: ILogger,
    namespace: string | null,
    resolveMetadata: MetadataResolver,
    getFilterRegistry?: FilterRegistryGetter,
    getSubscribers?: SubscriberRegistryGetter,
    amphora?: IAmphora,
  ) {
    this.options = options;
    this.logger = logger.child(["SqliteDriver"]);
    this.namespace = namespace;
    this.resolveMetadata = resolveMetadata;
    this.getFilterRegistry = getFilterRegistry ?? (() => new Map());
    this.getSubscribers = getSubscribers ?? (() => []);
    this.amphora = amphora;
  }

  public async connect(): Promise<void> {
    if (this.db) return;

    const BetterSqlite3 = await import("better-sqlite3");
    const Database = BetterSqlite3.default ?? BetterSqlite3;

    const database = new Database(this.options.filename, {
      readonly: this.options.readonly ?? false,
    });

    // Enable WAL mode for better concurrency
    database.pragma("journal_mode = WAL");
    // Enable foreign key enforcement
    database.pragma("foreign_keys = ON");
    // Set busy timeout for lock contention
    database.pragma(`busy_timeout = ${this.options.busyTimeout ?? 5000}`);

    // Apply user-supplied pragmas
    if (this.options.pragmas) {
      for (const [name, value] of Object.entries(this.options.pragmas)) {
        if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
          throw new SqliteDriverError(
            `Invalid pragma name: "${name}". Pragma names must be alphanumeric with underscores.`,
          );
        }
        database.pragma(`${name} = ${value}`);
      }
    }

    this.db = this.wrapDatabase(database);

    this.logger.debug("SQLite database opened", { filename: this.options.filename });
  }

  public async ping(): Promise<boolean> {
    try {
      const client = this.getClient();
      const row = client.get("SELECT 1 AS ok");
      return (row as any)?.ok === 1;
    } catch {
      return false;
    }
  }

  public async disconnect(): Promise<void> {
    if (!this.db) return;

    // better-sqlite3 close() is synchronous
    try {
      this.db.close();
    } catch {
      // Already closed
    }
    this.db = null;

    this.logger.debug("SQLite database closed");
  }

  public async setup(entities: Array<Constructor<IEntity>>): Promise<void> {
    if (this.options.synchronize && this.options.runMigrations) {
      throw new SqliteMigrationError(
        "synchronize and runMigrations are mutually exclusive — use one or the other",
      );
    }

    if (!this.db) {
      await this.connect();
    }

    if (this.options.runMigrations) {
      await this.runMigrations();
    } else if (this.options.synchronize) {
      this.synchronize(entities);
    }
  }

  public async query<R = unknown>(
    sql: string,
    values?: Array<unknown>,
  ): Promise<ProteusResult<R>> {
    const client = this.getClient();

    // Detect if it's a SELECT-like statement
    const trimmed = sql.trim().toUpperCase();
    if (trimmed.startsWith("SELECT") || trimmed.includes("RETURNING")) {
      const rows = client.all(sql, values) as Array<R>;
      return { rows, rowCount: rows.length };
    }

    const result = client.run(sql, values);
    return { rows: [] as Array<R>, rowCount: result.changes };
  }

  public createRepository<E extends IEntity>(
    target: Constructor<E>,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): SqliteRepository<E> {
    const client = this.getClient();
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createRepository(t, p, context);

    // withImplicitTransaction runs multi-step operations (owning relations, insert, inverse)
    // on the single SQLite connection without an explicit transaction.
    // better-sqlite3 calls are synchronous so they never interleave at the SQLite level;
    // using BEGIN IMMEDIATE here would conflict with concurrent async callers on the same
    // connection. Callers that require strict atomicity should use source.transaction().
    const withImplicitTransaction: WithImplicitTransaction<E> = (fn) => {
      const txExecutor = new SqliteExecutor<E>(
        client,
        metadata,
        namespace,
        this.getFilterRegistry(),
        this.amphora,
      );
      const txFactory: RepositoryFactory = <C extends IEntity>(
        t: Constructor<C>,
        p?: Constructor<IEntity>,
      ) => this.createRepository(t, p, context);
      return fn({ client, executor: txExecutor, repositoryFactory: txFactory });
    };

    return new SqliteRepository<E>({
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
      getSubscribers: this.getSubscribers,
      amphora: this.amphora,
    });
  }

  public createTransactionalRepository<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
    parent?: Constructor<IEntity>,
    context?: unknown,
  ): SqliteRepository<E> {
    const sqliteHandle = handle as SqliteTransactionHandle;
    const namespace = this.namespace;
    const metadata = this.resolveMetadata(target);
    const txClient = sqliteHandle.client;
    const txExecutor = new SqliteExecutor<E>(
      txClient,
      metadata,
      namespace,
      this.getFilterRegistry(),
      this.amphora,
    );

    const factory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p, context);

    // Already in a transaction — passthrough
    const withImplicitTransaction: WithImplicitTransaction<E> = async (fn) =>
      fn({ client: txClient, executor: txExecutor, repositoryFactory: factory });

    return new SqliteRepository<E>({
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
      getSubscribers: this.getSubscribers,
      amphora: this.amphora,
    });
  }

  public createExecutor<E extends IEntity>(
    target: Constructor<E>,
  ): IRepositoryExecutor<E> {
    const client = this.getClient();
    const metadata = this.resolveMetadata(target);
    return new SqliteExecutor<E>(
      client,
      metadata,
      this.namespace,
      this.getFilterRegistry(),
      this.amphora,
    );
  }

  public createTransactionalExecutor<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IRepositoryExecutor<E> {
    const metadata = this.resolveMetadata(target);
    const sqliteHandle = handle as SqliteTransactionHandle;
    return new SqliteExecutor<E>(
      sqliteHandle.client,
      metadata,
      this.namespace,
      this.getFilterRegistry(),
      this.amphora,
    );
  }

  public createQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
  ): IProteusQueryBuilder<E> {
    const client = this.getClient();
    const metadata = this.resolveMetadata(target);
    return new SqliteQueryBuilder<E>(metadata, client, this.namespace, this.logger);
  }

  public createTransactionalQueryBuilder<E extends IEntity>(
    target: Constructor<E>,
    handle: TransactionHandle,
  ): IProteusQueryBuilder<E> {
    const metadata = this.resolveMetadata(target);
    const sqliteHandle = handle as SqliteTransactionHandle;
    return new SqliteQueryBuilder<E>(
      metadata,
      sqliteHandle.client,
      this.namespace,
      this.logger,
    );
  }

  public async acquireClient(): Promise<SqliteQueryClient> {
    return this.getClient();
  }

  public cloneWithGetters(
    getFilterRegistry: FilterRegistryGetter,
    getSubscribers: SubscriberRegistryGetter,
  ): SqliteDriver {
    const cloned = Object.create(SqliteDriver.prototype) as SqliteDriver;
    (cloned as any).options = this.options;
    (cloned as any).logger = this.logger;
    (cloned as any).namespace = this.namespace;
    (cloned as any).resolveMetadata = this.resolveMetadata;
    (cloned as any).getFilterRegistry = getFilterRegistry;
    (cloned as any).getSubscribers = getSubscribers;
    (cloned as any).amphora = this.amphora;
    (cloned as any).db = this.db; // Share the same database connection
    return cloned;
  }

  public async beginTransaction(
    options?: TransactionOptions,
  ): Promise<TransactionHandle> {
    if (options?.isolation) {
      this.logger.warn(
        "SQLite does not support configurable isolation levels; ignoring provided isolation",
        { requestedIsolation: options.isolation },
      );
    }

    const client = this.getClient();
    return beginTransaction(client);
  }

  public async commitTransaction(handle: TransactionHandle): Promise<void> {
    commitTransaction(handle as SqliteTransactionHandle);
  }

  public async rollbackTransaction(handle: TransactionHandle): Promise<void> {
    rollbackTransaction(handle as SqliteTransactionHandle);
  }

  public async withTransaction<T>(
    callback: TransactionCallback<T>,
    options?: TransactionOptions,
  ): Promise<T> {
    // G4: SQLite does not support transaction retry — log warn if retry option is passed
    if (options?.retry) {
      this.logger.warn(
        "Transaction retry option is not supported by the SQLite driver and will be ignored. SQLite uses database-level locking — retries are not applicable.",
        { retry: options.retry },
      );
    }

    if (options?.isolation) {
      this.logger.warn(
        "SQLite does not support configurable isolation levels; ignoring provided isolation",
        { requestedIsolation: options.isolation },
      );
    }

    const client = this.getClient();
    const handle = beginTransaction(client);

    const repoFactory: RepositoryFactory = <C extends IEntity>(
      t: Constructor<C>,
      p?: Constructor<IEntity>,
    ) => this.createTransactionalRepository(t, handle, p);

    const ctx = new SqliteTransactionContext(
      handle,
      this.namespace,
      this.logger,
      repoFactory,
    );

    try {
      const result = await callback(ctx);

      if (handle.state === "active") {
        commitTransaction(handle);
      }

      return result;
    } catch (error) {
      if (handle.state === "active") {
        try {
          rollbackTransaction(handle);
        } catch {
          // Swallow rollback error — preserve the original error
        }
      }

      throw error;
    }
  }

  // Private

  private getClient(): SqliteQueryClient {
    if (!this.db) {
      throw new SqliteDriverError(
        "Not connected — call connect() before calling setup() or query()",
      );
    }
    return this.db;
  }

  private wrapDatabase(database: any): SqliteQueryClient {
    const slowThreshold = this.options.slowQueryThresholdMs;
    const logger = this.logger;

    const measureSlow = <T>(sql: string, fn: () => T): T => {
      if (!slowThreshold) return fn();

      const start = performance.now();
      const result = fn();
      const elapsed = performance.now() - start;

      if (elapsed > slowThreshold) {
        logger.warn("Slow query detected", {
          sql: sql.slice(0, 200),
          elapsed: Math.round(elapsed),
          threshold: slowThreshold,
        });
      }

      return result;
    };

    return {
      run: (sql, params) =>
        measureSlow(sql, () => database.prepare(sql).run(params ?? [])),
      all: (sql, params) =>
        measureSlow(sql, () => database.prepare(sql).all(params ?? [])),
      get: (sql, params) =>
        measureSlow(sql, () => database.prepare(sql).get(params ?? [])),
      exec: (sql) => database.exec(sql),
      iterate: (sql, params) => database.prepare(sql).iterate(params ?? []),
      close: () => database.close(),
      get open() {
        return database.open;
      },
      get name() {
        return database.name;
      },
    };
  }

  private synchronize(entities: Array<Constructor<IEntity>>): void {
    if (!this.options.synchronize) return;

    this.logger.warn(
      "Synchronize mode is enabled. This is intended for development only. Running in production will result in data loss.",
    );

    const client = this.getClient();
    const nsOptions = { namespace: this.namespace };

    const metadatas = entities.map((e) => this.resolveMetadata(e));

    const desired = projectDesiredSchema(metadatas, nsOptions);

    const managedTableNames = desired.tables.map((t) => t.name);

    const snapshot = introspectSchema(client, managedTableNames);

    const plan = diffSchema(snapshot, desired);
    const dryRun = this.options.synchronize === "dry-run";

    const result = new SyncPlanExecutor(this.logger).execute(client, plan, { dryRun });

    if (dryRun) {
      this.logger.info(
        `Dry-run sync complete: ${plan.operations.length} operations planned`,
      );
    } else {
      this.logger.info(`Sync complete: ${result.statementsExecuted} statements executed`);
    }
  }

  private async runMigrations(): Promise<void> {
    const directories = this.options.migrations ?? [];

    if (directories.length === 0) {
      this.logger.debug("No migration directories configured — skipping");
      return;
    }

    const client = this.getClient();

    const tableOptions = this.options.migrationsTable
      ? { table: this.options.migrationsTable }
      : undefined;

    for (const directory of directories) {
      const manager = new SqliteMigrationManager({
        client,
        directory,
        logger: this.logger,
        tableOptions,
      });

      const result = await manager.apply();

      if (result.applied.length > 0) {
        this.logger.info(
          `Applied ${result.applied.length} migration(s) from ${directory}: ${result.applied.map((a: { name: string }) => a.name).join(", ")}`,
        );
      } else {
        this.logger.debug(`No pending migrations in ${directory}`);
      }
    }
  }
}
