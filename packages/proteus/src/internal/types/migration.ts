// --- Base runner types (shared across all drivers) ---

export type MigrationRunnerBase = {
  transaction: (fn: (ctx: unknown) => Promise<void>) => Promise<void>;
};

// --- SQL-specific runner types ---

export type SqlMigrationContext = {
  query: (sql: string, params?: Array<unknown>) => Promise<void>;
};

export type SqlMigrationRunner = {
  transaction: (fn: (ctx: SqlMigrationContext) => Promise<void>) => Promise<void>;
  query: (sql: string, params?: Array<unknown>) => Promise<void>;
  /**
   * Install a database-scoped extension. A first-class step rather than another
   * `query` because it must NOT run inside the migration transaction:
   * `CREATE EXTENSION IF NOT EXISTS` is not atomic, so a concurrent deploy
   * against another schema of the same database makes the loser fail on
   * `pg_extension_name_index` — aborting the whole migration transaction and
   * every unrelated statement in it. The driver runs it in a transaction of its
   * own, under a database-wide advisory lock.
   *
   * Declared on the shared SQL runner, not a postgres-only one: narrowing the
   * runner in generated files would put `SqlMigrationInterface`'s function-typed
   * `up`/`down` members into a contravariance hazard. Drivers without extensions
   * throw.
   */
  extension: (name: string) => Promise<void>;
};

// --- Migration file interface ---

export type MigrationInterface = {
  readonly id: string;
  readonly ts: string;
  readonly driver?: string;
  up: (runner: MigrationRunnerBase) => Promise<void>;
  down: (runner: MigrationRunnerBase) => Promise<void>;
};

// --- SQL-specific migration interface (narrows runner to SqlMigrationRunner) ---

export type SqlMigrationInterface = {
  readonly id: string;
  readonly ts: string;
  readonly driver?: string;
  up: (runner: SqlMigrationRunner) => Promise<void>;
  down: (runner: SqlMigrationRunner) => Promise<void>;
};

// --- Loaded migration (file + metadata) ---

export type LoadedMigration = {
  migration: MigrationInterface;
  name: string;
};

// --- Tracking table types ---

export type MigrationRecord = {
  id: string;
  name: string;
  checksum: string;
  createdAt: Date;
  startedAt: Date;
  finishedAt: Date | null;
  rolledBackAt: Date | null;
};

export type MigrationTableSettings = {
  table?: string;
};

// --- Result types ---

export type MigrationApplyResult = {
  applied: Array<{ name: string; durationMs: number }>;
  skipped: number;
};

export type MigrationStatus = {
  applied: Array<MigrationRecord>;
  pending: Array<string>;
  inProgress: Array<MigrationRecord>;
};
