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
import { quoteQualifiedName } from "../quote-identifier.js";

const SYNC_LOCK_KEY_1 = 0x50524f54; // "PROT"

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

        const txOps = executableOps.filter((op) => !op.autocommit);
        const autocommitOps = executableOps.filter((op) => op.autocommit);

        // Announce the run at info so a real sync is visibly making progress
        // (individual ops also log at info) — a long sync is then distinguishable
        // from a hang.
        this.logger?.info(
          `Executing ${executableOps.length} sync operation(s)` +
            ` (${plan.summary.safe} safe, ${plan.summary.warning} warning,` +
            ` ${plan.summary.destructive} destructive)` +
            (lockTimeoutMs > 0 ? `, lock_timeout=${lockTimeoutMs}ms` : ""),
        );

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

        this.logger?.info(`Sync complete: ${executedSql.length} statements executed`, {
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

    this.logger.info("Dry-run sync plan", { summary: plan.summary });

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
        // Info (not debug) so a real sync's progress is visible at the default
        // log level — the difference between "slow" and "hung".
        this.logger.info(description, { sql });
        break;
    }
  };
}
