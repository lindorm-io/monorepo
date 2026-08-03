import type { ILogger } from "@lindorm/logger";
import { hashNamespaceToInt32 } from "../../../../utils/advisory-lock-name.js";
import { PostgresSyncError } from "../../errors/PostgresSyncError.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type {
  SyncOperation,
  SyncPlan,
  SyncOptions,
  SyncResult,
} from "../../types/sync-plan.js";
import { isPgLockTimeoutError } from "../abort.js";
import { withAdvisoryLock } from "../advisory-lock.js";
import { withAdvisoryXactLock } from "../advisory-xact-lock.js";
import { isPgDuplicateObjectError } from "../duplicate-object.js";
import { quoteQualifiedName } from "../quote-identifier.js";

const SYNC_LOCK_KEY_1 = 0x50524f54; // "PROT"

// Database-wide lock for `CREATE EXTENSION`. An extension is a DATABASE-scoped
// object, so the per-namespace sync lock cannot serialize it: two deploys
// against different schemas of the same database derive different lockKey2
// values, both see "not exists", and both attempt the create — the loser fails
// on `pg_extension_name_index`.
//
// Collision-free by construction: postgres keys an advisory lock on the (key1,
// key2) PAIR, and every other proteus lock — sync here, migration in
// MigrationManager — uses 0x50524f54 as key1. A different key1 therefore puts
// the extension lock in a space no namespace can reach, which key2 alone could
// never guarantee: `hashNamespaceToInt32` spans the whole int32 range, so some
// namespace hashes onto any key2 we might pick.
const EXTENSION_LOCK_KEY_1 = 0x50474558; // "PGEX"
const EXTENSION_LOCK_KEY_2 = 0x53594e43; // "SYNC" — fixed: extensions are not namespaced

type LockBlocker = {
  pid: number;
  state: string | null;
  application_name: string | null;
  query: string | null;
};

export class SyncPlanExecutor {
  private readonly logger: ILogger | undefined;
  private readonly lockKey2: number;

  constructor(logger?: ILogger, namespace?: string | null) {
    this.logger = logger?.child(["SyncPlanExecutor"]);
    // XOR the fixed "SYNC" marker with a namespace hash to isolate per-namespace
    this.lockKey2 = 0x53594e43 ^ hashNamespaceToInt32(namespace ?? null);
  }

  execute = async (
    client: PostgresQueryClient,
    plan: SyncPlan,
    options: SyncOptions = {},
  ): Promise<SyncResult> => {
    const { dryRun = false } = options;
    // Normalize to a non-negative integer; 0 (or undefined) means "wait forever".
    const lockTimeoutMs =
      options.lockTimeout != null && options.lockTimeout > 0
        ? Math.floor(options.lockTimeout)
        : 0;

    if (dryRun) {
      this.logPlan(plan);
      return {
        plan,
        executed: false,
        statementsExecuted: 0,
        executedSql: [],
        failedOperations: [],
      };
    }

    // Filter out warn_only operations — they are for logging only
    const executableOps = plan.operations.filter((op) => op.type !== "warn_only");
    const warnOps = plan.operations.filter((op) => op.type === "warn_only");

    // Log warnings
    for (const op of warnOps) {
      this.logger?.warn(op.description);
    }

    if (executableOps.length === 0) {
      this.logger?.debug("No sync operations to execute");
      return {
        plan,
        executed: true,
        statementsExecuted: 0,
        executedSql: [],
        failedOperations: [],
      };
    }

    const result = await withAdvisoryLock(
      client,
      SYNC_LOCK_KEY_1,
      this.lockKey2,
      async () => {
        const executedSql: Array<string> = [];
        const failedOperations: Array<{ operation: SyncOperation; error: Error }> = [];

        const extensionOps = executableOps.filter((op) => op.type === "create_extension");
        const txOps = executableOps.filter(
          (op) => !op.autocommit && op.type !== "create_extension",
        );
        const autocommitOps = executableOps.filter((op) => op.autocommit);

        // Announce the run at verbose so a real sync is visibly making progress
        // when investigating (individual ops log at debug) — a long sync is then
        // distinguishable from a hang without adding noise at the prod default.
        this.logger?.verbose(
          `Executing ${executableOps.length} sync operation(s)` +
            ` (${plan.summary.safe} safe, ${plan.summary.warning} warning,` +
            ` ${plan.summary.destructive} destructive)` +
            (lockTimeoutMs > 0 ? `, lock_timeout=${lockTimeoutMs}ms` : ""),
        );

        // Phase 0: Extensions — database-scoped objects, so they run under a
        // database-wide lock in their own transaction (see createExtension).
        for (const op of extensionOps) {
          const created = await this.createExtension(client, op, lockTimeoutMs);
          if (created) executedSql.push(op.sql);
        }

        // Phase 1: Transactional
        if (txOps.length > 0) {
          await client.query("BEGIN");

          // Bound how long any statement waits to ACQUIRE a lock. SET LOCAL is
          // scoped to this transaction and auto-resets on COMMIT/ROLLBACK, so it
          // never leaks into the pooled connection. Distinct from
          // statement_timeout: a legitimately long-running DDL statement is not
          // affected — only waiting on a lock held by another session is.
          if (lockTimeoutMs > 0) {
            await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
          }

          let currentOp: SyncOperation | undefined;

          try {
            for (const op of txOps) {
              currentOp = op;
              this.logOperation(op.severity, op.description, op.sql);
              await client.query(op.sql);
              executedSql.push(op.sql);
            }

            await client.query("COMMIT");
          } catch (error) {
            try {
              await client.query("ROLLBACK");
            } catch {
              // ROLLBACK failure is secondary — preserve the original sync error
            }

            if (isPgLockTimeoutError(error)) {
              throw await this.buildLockTimeoutError(
                client,
                currentOp,
                lockTimeoutMs,
                error as Error,
              );
            }

            throw new PostgresSyncError("Sync transaction failed", {
              code: "sync_failed",
              title: "Sync Failed",
              details:
                "A schema sync DDL statement failed inside the transactional phase; the transaction was rolled back.",
              error: error as Error,
            });
          }
        }

        // Phase 2: Autocommit (ADD ENUM VALUE, CREATE INDEX CONCURRENTLY).
        // These run outside a transaction and already degrade gracefully
        // (failures are collected, not fatal), so lock_timeout is not applied
        // here — a session-level SET would risk leaking into the pooled
        // connection, and CONCURRENTLY builds are non-blocking by design.
        for (const op of autocommitOps) {
          this.logOperation(op.severity, op.description, op.sql);
          try {
            await client.query(op.sql);
            executedSql.push(op.sql);
          } catch (error) {
            this.logger?.warn("Autocommit operation failed, continuing", {
              description: op.description,
              sql: op.sql,
              error,
            });
            failedOperations.push({ operation: op, error: error as Error });
          }
        }

        this.logger?.verbose(`Sync complete: ${executedSql.length} statements executed`, {
          summary: plan.summary,
        });

        return {
          plan,
          executed: true,
          statementsExecuted: executedSql.length,
          executedSql,
          failedOperations,
        } satisfies SyncResult;
      },
    );

    if (result === null) {
      this.logger?.warn(
        "Could not acquire sync lock — another sync process is running, skipping",
      );
      return {
        plan,
        executed: false,
        statementsExecuted: 0,
        executedSql: [],
        failedOperations: [],
      };
    }

    return result;
  };

  /**
   * Create one extension under the DATABASE-WIDE advisory lock, in a
   * transaction of its own. Returns whether this session did the creating.
   *
   * Own transaction for two reasons. The lock is transaction-scoped, so COMMIT
   * both releases it and ends the only window in which sync is serialized
   * database-wide — the namespace-scoped plan that follows keeps its
   * per-schema parallelism. And an extension failure can then only abort
   * itself: inside the main transaction it would take every unrelated DDL
   * statement down with it, which is exactly how the race lost an index while
   * the extension it needed existed.
   *
   * Lock ordering is fixed — namespace lock (try, never waits) before this one
   * — so the blocking wait here cannot close a cycle.
   */
  private createExtension = async (
    client: PostgresQueryClient,
    op: SyncOperation,
    lockTimeoutMs: number,
  ): Promise<boolean> => {
    await client.query("BEGIN");

    // Bounds the wait for the advisory lock AND for a peer's uncommitted
    // pg_extension row. SET LOCAL resets on COMMIT/ROLLBACK.
    if (lockTimeoutMs > 0) {
      await client.query(`SET LOCAL lock_timeout = '${lockTimeoutMs}ms'`);
    }

    try {
      await withAdvisoryXactLock(
        client,
        EXTENSION_LOCK_KEY_1,
        EXTENSION_LOCK_KEY_2,
        async () => {
          this.logOperation(op.severity, op.description, op.sql);
          await client.query(op.sql);
        },
      );

      await client.query("COMMIT");

      return true;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        // ROLLBACK failure is secondary — preserve the original error
      }

      if (isPgLockTimeoutError(error)) {
        throw new PostgresSyncError(
          `Sync timed out creating extension "${op.extension ?? "?"}"`,
          {
            code: "sync_lock_timeout",
            title: "Sync Lock Timeout",
            details:
              `Schema sync waited more than ${lockTimeoutMs}ms for the database-wide extension ` +
              `lock, or for a concurrent session's extension transaction to finish. Retry, or ` +
              `raise \`syncLockTimeout\` (0 waits indefinitely).`,
            data: { extension: op.extension ?? null, lockTimeoutMs },
            error: error as Error,
          },
        );
      }

      // Belt and braces: the lock only binds sessions that take it. A migration
      // tool, a DBA or another app can create the extension between our check
      // and our CREATE — and then the statement's goal is already met.
      if (
        isPgDuplicateObjectError(error) &&
        op.extension &&
        (await this.extensionExists(client, op.extension))
      ) {
        this.logger?.debug("Extension already created by a concurrent session", {
          extension: op.extension,
        });

        return false;
      }

      throw new PostgresSyncError(`Failed to create extension "${op.extension ?? "?"}"`, {
        code: "sync_failed",
        title: "Sync Failed",
        details:
          "A schema sync could not create a required PostgreSQL extension; the extension transaction was rolled back and no other DDL ran.",
        data: { extension: op.extension ?? null },
        error: error as Error,
      });
    }
  };

  /**
   * Whether the extension is installed in this database. Fails closed: a
   * lookup that itself errors reports "not present", so the caller rethrows the
   * original failure rather than swallowing it on a guess.
   */
  private extensionExists = async (
    client: PostgresQueryClient,
    extension: string,
  ): Promise<boolean> => {
    try {
      const { rows } = await client.query(
        `SELECT 1 FROM pg_extension WHERE extname = $1`,
        [extension],
      );
      return rows.length > 0;
    } catch {
      return false;
    }
  };

  /**
   * Build an actionable error for a `lock_timeout` abort: name the blocked
   * operation and, best-effort, the sessions currently holding a lock on the
   * target table (so the operator can identify the idle-in-transaction peer).
   * Diagnostics failure never masks the original timeout.
   */
  private buildLockTimeoutError = async (
    client: PostgresQueryClient,
    op: SyncOperation | undefined,
    lockTimeoutMs: number,
    error: Error,
  ): Promise<PostgresSyncError> => {
    const qualified =
      op && op.table ? quoteQualifiedName(op.schema, op.table) : "the target table";

    const blockers = op?.table
      ? await this.describeLockBlockers(client, op.schema, op.table)
      : [];

    const blockerText = blockers.length
      ? " Blocking session(s): " +
        blockers
          .map(
            (b) =>
              `pid ${b.pid} [${b.state ?? "?"}${
                b.application_name ? `, ${b.application_name}` : ""
              }]${b.query ? `: ${b.query}` : ""}`,
          )
          .join("; ")
      : "";

    this.logger?.warn(
      `Sync aborted: timed out after ${lockTimeoutMs}ms waiting for a lock on ${qualified}.` +
        blockerText,
    );

    return new PostgresSyncError(`Sync timed out waiting for a lock on ${qualified}`, {
      code: "sync_lock_timeout",
      title: "Sync Lock Timeout",
      details:
        `Schema sync could not acquire the lock needed to run "${op?.description ?? "a DDL statement"}" ` +
        `within ${lockTimeoutMs}ms — another session holds a conflicting lock on ${qualified} ` +
        `(commonly an idle-in-transaction connection). Release the blocking session, or raise ` +
        `\`syncLockTimeout\` (0 waits indefinitely).${blockerText}`,
      data: {
        table: qualified,
        lockTimeoutMs,
        operation: op?.description ?? null,
        blockers,
      },
      error,
    });
  };

  /**
   * Best-effort lookup of sessions holding a granted lock on the given table,
   * excluding this backend. Reads only system views (no table locks taken), so
   * it cannot itself block. Returns [] on any failure.
   */
  private describeLockBlockers = async (
    client: PostgresQueryClient,
    schema: string | null,
    table: string,
  ): Promise<Array<LockBlocker>> => {
    try {
      const qualified = quoteQualifiedName(schema, table);
      const { rows } = await client.query<LockBlocker>(
        `SELECT a.pid, a.state, a.application_name, left(a.query, 200) AS query
           FROM pg_locks l
           JOIN pg_stat_activity a ON a.pid = l.pid
          WHERE l.relation = $1::regclass
            AND l.granted
            AND a.pid <> pg_backend_pid()`,
        [qualified],
      );
      return rows;
    } catch {
      return [];
    }
  };

  private logPlan = (plan: SyncPlan): void => {
    if (!this.logger) return;

    this.logger.verbose("Dry-run sync plan", { summary: plan.summary });

    for (const op of plan.operations) {
      this.logOperation(op.severity, op.description, op.sql);
    }
  };

  private logOperation = (severity: string, description: string, sql: string): void => {
    if (!this.logger) return;

    switch (severity) {
      case "destructive":
        this.logger.warn(description, { sql });
        break;
      case "warning":
        this.logger.warn(description, { sql });
        break;
      default:
        // Per-statement DDL — debug: fine-grained internal flow, too chatty for
        // the prod default. Visible when investigating a slow/hung sync.
        this.logger.debug(description, { sql });
        break;
    }
  };
}
