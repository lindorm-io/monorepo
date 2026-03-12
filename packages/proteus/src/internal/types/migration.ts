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

export type MigrationTableOptions = {
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
