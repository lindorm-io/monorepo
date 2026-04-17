import type { ILogger } from "@lindorm/logger";
import { buildMysqlLockName } from "../../../../utils/advisory-lock-name";
import { MySqlSyncError } from "../../errors/MySqlSyncError";
import type { MysqlQueryClient } from "../../types/mysql-query-client";
import type {
  MysqlSyncOperation,
  MysqlSyncOptions,
  MysqlSyncPlan,
  MysqlSyncResult,
} from "../../types/sync-plan";

/**
 * Executes a MySQL sync plan against the database.
 *
 * MySQL DDL is auto-committed (not transactional). We use GET_LOCK/RELEASE_LOCK
 * advisory locking to prevent concurrent sync operations.
 *
 * Operations are executed in order — create_table ops should already be
 * topologically sorted by the diff phase.
 */
export class SyncPlanExecutor {
  private readonly logger: ILogger | undefined;
  private readonly lockName: string;

  public constructor(logger?: ILogger, namespace?: string | null) {
    this.logger = logger?.child(["SyncPlanExecutor"]);
    this.lockName = buildMysqlLockName("proteus_sync", namespace ?? null);
  }

  public execute = async (
    client: MysqlQueryClient,
    plan: MysqlSyncPlan,
    options: MysqlSyncOptions = {},
  ): Promise<MysqlSyncResult> => {
    const { dryRun = false, skipLock = false } = options;

    if (dryRun) {
      this.logPlan(plan);
      return {
        plan,
        executed: false,
        statementsExecuted: 0,
        executedSql: [],
      };
    }

    if (plan.operations.length === 0) {
      this.logger?.debug("No sync operations to execute");
      return {
        plan,
        executed: true,
        statementsExecuted: 0,
        executedSql: [],
      };
    }

    // Acquire advisory lock (unless caller already holds it)
    if (!skipLock) {
      const lockAcquired = await this.acquireLock(client);
      if (!lockAcquired) {
        throw new MySqlSyncError(
          "Could not acquire sync advisory lock — another sync process is running",
        );
      }
    }

    const executedSql: Array<string> = [];

    try {
      // Disable FK checks during sync — MySQL won't let you drop an index
      // that backs a FK constraint, and CREATE TABLE ordering can reference
      // tables not yet created. Re-enabled in the finally block.
      await client.query("SET FOREIGN_KEY_CHECKS = 0");

      for (const op of plan.operations) {
        this.logger?.debug(`Executing: ${this.describeOperation(op)}`, { sql: op.sql });
        await client.query(op.sql);
        executedSql.push(op.sql);
      }

      this.logger?.info(`Sync complete: ${executedSql.length} statements executed`);
    } finally {
      try {
        await client.query("SET FOREIGN_KEY_CHECKS = 1");
      } catch (err) {
        this.logger?.warn("Failed to re-enable FOREIGN_KEY_CHECKS after sync", {
          error: err,
        });
      }
      if (!skipLock) {
        await this.releaseLock(client);
      }
    }

    return {
      plan,
      executed: true,
      statementsExecuted: executedSql.length,
      executedSql,
    };
  };

  private acquireLock = async (client: MysqlQueryClient): Promise<boolean> => {
    const { rows } = await client.query<{ lock_result: number | null }>(
      `SELECT GET_LOCK(?, 30) AS lock_result`,
      [this.lockName],
    );
    const result = rows[0]?.lock_result;
    return result === 1;
  };

  private releaseLock = async (client: MysqlQueryClient): Promise<void> => {
    try {
      await client.query(`SELECT RELEASE_LOCK(?)`, [this.lockName]);
    } catch {
      // Best effort — lock will expire on session close
    }
  };

  private describeOperation = (op: MysqlSyncOperation): string => {
    switch (op.type) {
      case "create_table":
        return `Create table "${op.tableName}"`;
      case "add_column":
        return `Add column on "${op.tableName}"`;
      case "modify_column":
        return `Modify column "${op.columnName}" on "${op.tableName}"`;
      case "drop_column":
        return `Drop column "${op.columnName}" on "${op.tableName}"`;
      case "add_index":
        return `Add index "${op.indexName}" on "${op.tableName}"`;
      case "drop_index":
        return `Drop index "${op.indexName}" on "${op.tableName}"`;
      case "add_fk":
        return `Add FK "${op.constraintName}" on "${op.tableName}"`;
      case "drop_fk":
        return `Drop FK "${op.constraintName}" on "${op.tableName}"`;
      case "add_check":
        return `Add check "${op.constraintName}" on "${op.tableName}"`;
      case "add_unique":
        return `Add unique "${op.constraintName}" on "${op.tableName}"`;
      case "drop_constraint":
        return `Drop constraint "${op.constraintName}" on "${op.tableName}"`;
      case "create_trigger":
        return `Create trigger "${op.triggerName}" on "${op.tableName}"`;
      case "drop_trigger":
        return `Drop trigger "${op.triggerName}" on "${op.tableName}"`;
    }
  };

  private logPlan = (plan: MysqlSyncPlan): void => {
    if (!this.logger) return;

    this.logger.info(`Dry-run sync plan: ${plan.operations.length} operation(s)`);

    for (const op of plan.operations) {
      this.logger.debug(this.describeOperation(op));
    }
  };
}
