import type { ILogger } from "@lindorm/logger";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import { isPgLockTimeoutError } from "./abort.js";
import { withAdvisoryXactLock } from "./advisory-xact-lock.js";
import { isPgDuplicateObjectError } from "./duplicate-object.js";

// Database-wide lock for `CREATE EXTENSION`. An extension is a DATABASE-scoped
// object, so a per-namespace lock cannot serialize it: two deploys against
// different schemas of the same database derive different lockKey2 values, both
// see "not exists", and both attempt the create — the loser fails on
// `pg_extension_name_index`.
//
// Collision-free by construction: postgres keys an advisory lock on the (key1,
// key2) PAIR, and every other proteus lock — sync in SyncPlanExecutor, migration
// in MigrationManager — uses 0x50524f54 as key1. A different key1 therefore puts
// the extension lock in a space no namespace can reach, which key2 alone could
// never guarantee: `hashNamespaceToInt32` spans the whole int32 range, so some
// namespace hashes onto any key2 we might pick.
export const EXTENSION_LOCK_KEY_1 = 0x50474558; // "PGEX"

// Fixed key2 — extensions are not namespaced. SHARED by the sync path and the
// migration path deliberately: a `synchronize` deploy and a `migrate` deploy
// racing on the same database must take the SAME lock or they do not exclude
// each other and the race is back. The value is historical ("SYNC"); it carries
// no meaning beyond "the one extension lock" and must never change.
export const EXTENSION_LOCK_KEY_2 = 0x53594e43;

export type CreateExtensionOptions = {
  /** Logged at debug alongside the statement, e.g. `Create extension "pg_trgm"`. */
  description: string;
  /**
   * Name of the extension being created. `undefined` when the caller cannot name
   * it — a duplicate-object failure can then never be judged benign, because
   * there is nothing to look up in `pg_extension`.
   */
  extension: string | undefined;
  /** `0` waits indefinitely; anything higher becomes a `SET LOCAL lock_timeout`. */
  lockTimeoutMs: number;
  logger?: ILogger;
  sql: string;
};

export type CreateExtensionOutcome =
  | { status: "created" }
  | { status: "already_present" }
  | { status: "lock_timeout"; error: Error }
  | { status: "failed"; error: Error };

/**
 * Whether the extension is installed in this database. Fails closed: a lookup
 * that itself errors reports "not present", so the caller surfaces the original
 * failure rather than swallowing it on a guess.
 */
const extensionExists = async (
  client: PostgresQueryClient,
  extension: string,
): Promise<boolean> => {
  try {
    const { rows } = await client.query(`SELECT 1 FROM pg_extension WHERE extname = $1`, [
      extension,
    ]);
    return rows.length > 0;
  } catch {
    return false;
  }
};

/**
 * Create one extension under the DATABASE-WIDE advisory lock, in a transaction
 * of its own. RETURNS a decision — every caller throws its own domain error.
 *
 * Own transaction for two reasons. The lock is transaction-scoped, so COMMIT
 * both releases it and ends the only window in which the caller is serialized
 * database-wide — the namespace-scoped work that follows keeps its per-schema
 * parallelism. And an extension failure can then only abort itself: inside the
 * caller's transaction it would take every unrelated DDL statement down with it,
 * which is exactly how the race lost an index while the extension it needed
 * existed.
 *
 * Lock ordering is fixed — the caller's namespace lock (try-locked, never waits)
 * before this one — so the blocking wait here cannot close a cycle.
 */
export const createExtensionLocked = async (
  client: PostgresQueryClient,
  options: CreateExtensionOptions,
): Promise<CreateExtensionOutcome> => {
  const { description, extension, lockTimeoutMs, logger, sql } = options;

  await client.query("BEGIN");

  // Bounds the wait for the advisory lock AND for a peer's uncommitted
  // pg_extension row. SET LOCAL resets on COMMIT/ROLLBACK, so it never leaks
  // into the pooled connection.
  if (lockTimeoutMs > 0) {
    await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
  }

  try {
    await withAdvisoryXactLock(
      client,
      EXTENSION_LOCK_KEY_1,
      EXTENSION_LOCK_KEY_2,
      async () => {
        logger?.debug(description, { sql });
        await client.query(sql);
      },
    );

    await client.query("COMMIT");

    return { status: "created" };
  } catch (error) {
    try {
      await client.query("ROLLBACK");
    } catch {
      // ROLLBACK failure is secondary — preserve the original error
    }

    if (isPgLockTimeoutError(error)) {
      return { status: "lock_timeout", error: error as Error };
    }

    // Belt and braces: the lock only binds sessions that take it. A migration
    // tool, a DBA or another app can create the extension between our check and
    // our CREATE — and then the statement's goal is already met.
    if (
      isPgDuplicateObjectError(error) &&
      extension &&
      (await extensionExists(client, extension))
    ) {
      return { status: "already_present" };
    }

    return { status: "failed", error: error as Error };
  }
};
