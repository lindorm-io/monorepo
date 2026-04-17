import type { ILogger } from "@lindorm/logger";
import { hashNamespaceToInt32 } from "../../../../utils/advisory-lock-name";
import { PostgresSyncError } from "../../errors/PostgresSyncError";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type {
  SyncOperation,
  SyncPlan,
  SyncOptions,
  SyncResult,
} from "../../types/sync-plan";
import { withAdvisoryLock } from "../advisory-lock";

const SYNC_LOCK_KEY_1 = 0x50524f54; // "PROT"

export class SyncPlanExecutor {
  private readonly logger: ILogger | undefined;
  private readonly lockKey2: number;

  public constructor(logger?: ILogger, namespace?: string | null) {
    this.logger = logger?.child(["SyncPlanExecutor"]);
    // XOR the fixed "SYNC" marker with a namespace hash to isolate per-namespace
    this.lockKey2 = 0x53594e43 ^ hashNamespaceToInt32(namespace ?? null);
  }

  public execute = async (
    client: PostgresQueryClient,
    plan: SyncPlan,
    options: SyncOptions = {},
  ): Promise<SyncResult> => {
    const { dryRun = false } = options;

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

        // Phase 1: Transactional
        if (txOps.length > 0) {
          await client.query("BEGIN");

          try {
            for (const op of txOps) {
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
            throw new PostgresSyncError("Sync transaction failed", {
              error: error as Error,
            });
          }
        }

        // Phase 2: Autocommit (ADD ENUM VALUE, CREATE INDEX CONCURRENTLY)
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
        this.logger.debug(description, { sql });
        break;
    }
  };
}
