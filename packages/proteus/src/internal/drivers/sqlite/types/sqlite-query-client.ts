/**
 * A row returned from a better-sqlite3 query.
 */
export type SqliteRow = Record<string, unknown>;

/**
 * Typed wrapper around the better-sqlite3 Database instance.
 * All operations are synchronous (better-sqlite3 design).
 */
export type SqliteQueryClient = {
  /** Execute a statement that returns no rows (INSERT/UPDATE/DELETE). */
  run(
    sql: string,
    params?: ReadonlyArray<unknown>,
  ): { changes: number; lastInsertRowid: number | bigint };
  /** Execute a statement that returns multiple rows (SELECT). */
  all(sql: string, params?: ReadonlyArray<unknown>): Array<SqliteRow>;
  /** Execute a statement that returns the first row, or undefined (SELECT with LIMIT 1). */
  get(sql: string, params?: ReadonlyArray<unknown>): SqliteRow | undefined;
  /** Execute a raw SQL string (no params, no result). Used for PRAGMA and DDL. */
  exec(sql: string): void;
  /** Create an iterator over a SELECT result. */
  iterate(sql: string, params?: ReadonlyArray<unknown>): IterableIterator<SqliteRow>;
  /** Close the database connection. */
  close(): void;
  /** Whether the database connection is open. */
  readonly open: boolean;
  /** The path to the database file. */
  readonly name: string;
};
