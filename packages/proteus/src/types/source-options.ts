import type { IAmphora } from "@lindorm/amphora";
import type { CircuitBreakerOptions } from "@lindorm/breaker";
import type { ReadableTime } from "@lindorm/date";
import type { ILogger } from "@lindorm/logger";
import type { ConnectionOptions } from "node:tls";
import type { IEntity } from "../interfaces/index.js";
import type { ICacheAdapter } from "../interfaces/CacheAdapter.js";
import type { EntityScannerInput } from "./scanner.js";

/**
 * Circuit breaker configuration for ProteusSource.
 *
 * All fields from CircuitBreakerOptions are available except `name`
 * (auto-generated from the driver type).
 */
export type ProteusBreakerOptions = Partial<Omit<CircuitBreakerOptions, "name">>;

/**
 * Control how entity field names are transformed to database column names.
 *
 * - `"snake"` — convert camelCase to snake_case
 * - `"camel"` — convert snake_case to camelCase
 * - `"none"` — use field names as-is (default)
 */
export type NamingStrategy = "snake" | "camel" | "none";

/**
 * Configure query-level caching for a ProteusSource.
 */
export type ProteusCacheConfig = {
  /** Cache adapter implementation (e.g. MemoryCacheAdapter). */
  adapter: ICacheAdapter;
  /** Default TTL applied to all cached queries unless overridden per-query. */
  ttl?: ReadableTime;
};

/**
 * Shared configuration fields for all ProteusSource drivers.
 */
export type ProteusSourceOptionsBase = {
  /** Entity classes or glob patterns to register with this source. */
  entities?: EntityScannerInput<IEntity>;
  /** Enable query caching with the given adapter and default TTL. */
  cache?: ProteusCacheConfig;
  /** Arbitrary context passed to hooks and lifecycle callbacks. */
  context?: unknown;
  /** Naming strategy for column name transformation. Defaults to `"none"`. */
  naming?: NamingStrategy;
  /** Database namespace (schema in SQL, database in Mongo, key prefix in Redis). */
  namespace?: string;
  /** Logger instance used for query logging and diagnostics. */
  logger: ILogger;
  /** Amphora key store for field-level encryption. When provided, @Encrypted fields are encrypted/decrypted transparently. */
  amphora?: IAmphora;
  /**
   * Circuit breaker for database operations. Protects against cascading failures
   * when the database is unreachable by failing fast instead of waiting for timeouts.
   *
   * - `true` — enabled with driver-appropriate defaults (default for network drivers)
   * - `false` — disabled
   * - `ProteusBreakerOptions` — enabled with custom overrides
   *
   * Automatically disabled for `memory` and `sqlite` drivers (no network I/O).
   */
  breaker?: boolean | ProteusBreakerOptions;
};

/**
 * Schema management options for drivers that support DDL migrations
 * and automatic schema synchronization (SQL drivers, MongoDB).
 */
export type SchemaManagementOptions = {
  /** File paths or glob patterns for migration files. */
  migrations?: Array<string>;
  /** Custom table name for the migrations ledger. Defaults to driver convention. */
  migrationsTable?: string;
  /** Run pending migrations automatically on source initialization. */
  runMigrations?: boolean;
  /**
   * Synchronize the database schema with entity metadata on initialization.
   *
   * - `true` — apply DDL changes
   * - `"dry-run"` — log planned DDL without executing
   */
  synchronize?: boolean | "dry-run";
};

/** In-memory driver has no external configuration. */
export type MemoryConfig = {
  driver: "memory";
};

/**
 * Driver configuration for MongoDB.
 */
export type MongoConfig = {
  driver: "mongo";
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

/**
 * Driver configuration for MySQL.
 */
export type MysqlConfig = {
  driver: "mysql";
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Connection pool settings. */
  pool?: {
    min?: number;
    max?: number;
    /** Maximum time in milliseconds to wait for a connection from the pool. */
    connectionTimeoutMillis?: number;
    /** Maximum number of queued connection requests before rejecting. 0 = unlimited. */
    queueLimit?: number;
  };
  /** TLS configuration passed to mysql2 `ssl` option. */
  ssl?: {
    ca?: string;
    cert?: string;
    key?: string;
    rejectUnauthorized?: boolean;
  } & Record<string, unknown>;
  /** Connection character set. Defaults to `utf8mb4`. */
  charset?: string;
  /** Enable protocol-level compression for remote connections. */
  compress?: boolean;
  /** Queries exceeding this threshold (ms) are logged as slow. */
  slowQueryThresholdMs?: number;
};

/**
 * Driver configuration for PostgreSQL.
 */
export type PostgresConfig = {
  driver: "postgres";
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  database?: string;
  /** Connection pool settings. */
  pool?: {
    min?: number;
    max?: number;
    /** Maximum time in milliseconds to wait for a connection from the pool. */
    connectionTimeoutMillis?: number;
    /** Close and replace a connection after this many uses. */
    maxUses?: number;
    /** Close idle connections after this many milliseconds. */
    idleTimeoutMillis?: number;
  };
  /** TLS configuration. `true` uses default TLS settings. */
  ssl?: boolean | ConnectionOptions;
  /** Maximum time in milliseconds a statement may run before being cancelled. */
  statementTimeout?: number;
  /** Time in milliseconds before an idle-in-transaction session is terminated. */
  idleTimeout?: number;
  /** Application name visible in `pg_stat_activity`. Useful for monitoring. */
  applicationName?: string;
  /** Queries exceeding this threshold (ms) are logged as slow. */
  slowQueryThresholdMs?: number;
};

/**
 * Driver configuration for Redis.
 */
export type RedisConfig = {
  driver: "redis";
  url?: string;
  host?: string;
  port?: number;
  user?: string;
  password?: string;
  db?: number;
  /** Maximum retries per request. Defaults to `3`. Set to `null` for infinite retries (not recommended — causes hangs). */
  maxRetriesPerRequest?: number | null;
  /** Timeout in milliseconds for the initial connection. */
  connectTimeout?: number;
  /** Timeout in milliseconds for individual commands. */
  commandTimeout?: number;
  /** TCP keep-alive interval in milliseconds. 0 = disabled. */
  keepAlive?: number;
  /** Connection name visible in Redis `CLIENT LIST`. */
  connectionName?: string;
  /** Wait for a successful `INFO` response before marking as ready. Defaults to `true`. */
  enableReadyCheck?: boolean;
  /** TLS options for encrypted connections. */
  tls?: ConnectionOptions;
  /**
   * Custom reconnection strategy. Called with the number of reconnection attempts so far.
   * Return a number (delay in ms) to schedule the next reconnection attempt,
   * or `null` to stop reconnecting.
   */
  retryStrategy?: (times: number) => number | null;
};

/**
 * Driver configuration for SQLite.
 */
export type SqliteConfig = {
  driver: "sqlite";
  /** Path to the SQLite database file. Use `:memory:` for an in-memory database. */
  filename: string;
  /** Whether to open the database in readonly mode. Defaults to false. */
  readonly?: boolean;
  /** Milliseconds to wait when the database is locked before throwing. Defaults to 5000. */
  busyTimeout?: number;
  /** Additional PRAGMA statements to execute on connection. Keys are pragma names, values are the setting. */
  pragmas?: Record<string, string | number | boolean>;
  /** Queries exceeding this threshold (ms) are logged as slow. */
  slowQueryThresholdMs?: number;
};

/** ProteusSource options for the in-memory driver. */
export type ProteusMemoryOptions = ProteusSourceOptionsBase & MemoryConfig;

/** ProteusSource options for the MongoDB driver. */
export type ProteusMongoOptions = ProteusSourceOptionsBase &
  SchemaManagementOptions &
  MongoConfig;

/** ProteusSource options for the MySQL driver. */
export type ProteusMysqlOptions = ProteusSourceOptionsBase &
  SchemaManagementOptions &
  MysqlConfig;

/** ProteusSource options for the PostgreSQL driver. */
export type ProteusPostgresOptions = ProteusSourceOptionsBase &
  SchemaManagementOptions &
  PostgresConfig;

/** ProteusSource options for the Redis driver. */
export type ProteusRedisOptions = ProteusSourceOptionsBase & RedisConfig;

/** ProteusSource options for the SQLite driver. */
export type ProteusSqliteOptions = ProteusSourceOptionsBase &
  SchemaManagementOptions &
  SqliteConfig;

/**
 * Union of all driver-specific ProteusSource option types.
 *
 * Pass to `new ProteusSource(options)` — the `driver` field determines which backend is used.
 */
export type ProteusSourceOptions =
  | ProteusMemoryOptions
  | ProteusMongoOptions
  | ProteusMysqlOptions
  | ProteusPostgresOptions
  | ProteusRedisOptions
  | ProteusSqliteOptions;
