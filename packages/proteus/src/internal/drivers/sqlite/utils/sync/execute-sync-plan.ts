import type { ILogger } from "@lindorm/logger";
import { SqliteSyncError } from "../../errors/SqliteSyncError";
import type { SqliteQueryClient } from "../../types/sqlite-query-client";
import type {
  SqliteSyncOperation,
  SqliteSyncOptions,
  SqliteSyncPlan,
  SqliteSyncResult,
} from "../../types/sync-plan";
import { quoteIdentifier } from "../quote-identifier";

export class SyncPlanExecutor {
  private readonly logger: ILogger | undefined;

  public constructor(logger?: ILogger) {
    this.logger = logger?.child(["SyncPlanExecutor"]);
  }

  public execute = (
    client: SqliteQueryClient,
    plan: SqliteSyncPlan,
    options: SqliteSyncOptions = {},
  ): SqliteSyncResult => {
    const { dryRun = false } = options;

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

    const executedSql: Array<string> = [];

    // Separate recreate operations from simple operations.
    // Recreate operations need special handling (EXCLUSIVE transaction with PRAGMA foreign_keys = OFF).
    const recreateOps = plan.operations.filter((op) => op.type === "recreate_table");
    const simpleOps = plan.operations.filter((op) => op.type !== "recreate_table");

    // Phase 1: Execute simple operations in a single transaction
    if (simpleOps.length > 0) {
      const sortedOps = this.topologicallySortCreateTables(simpleOps);

      try {
        client.exec("BEGIN IMMEDIATE");

        for (const op of sortedOps) {
          const sql = this.getOperationSql(op);
          this.logger?.debug(`Executing: ${this.describeOperation(op)}`, { sql });
          client.exec(sql);
          executedSql.push(sql);
        }

        client.exec("COMMIT");
      } catch (error) {
        try {
          client.exec("ROLLBACK");
        } catch {
          // ROLLBACK failure is secondary — preserve the original error
        }
        throw new SqliteSyncError("Sync transaction failed", { error: error as Error });
      }
    }

    // Phase 2: Execute recreate-table operations, each in its own EXCLUSIVE transaction
    for (const op of recreateOps) {
      if (op.type !== "recreate_table") continue;
      this.executeRecreateTable(client, op, executedSql);
    }

    this.logger?.info(`Sync complete: ${executedSql.length} statements executed`);

    return {
      plan,
      executed: true,
      statementsExecuted: executedSql.length,
      executedSql,
    };
  };

  /**
   * Executes the SQLite 12-step ALTER TABLE workaround for recreating a table.
   *
   * Per SQLite docs, PRAGMA foreign_keys cannot be changed inside a transaction,
   * so it must be disabled BEFORE BEGIN and re-enabled AFTER COMMIT.
   *
   * Steps:
   * 1. PRAGMA foreign_keys = OFF (before transaction)
   * 2. BEGIN EXCLUSIVE
   * 3. CREATE TABLE "_new_tablename" (new schema)
   * 4. INSERT INTO "_new_tablename" SELECT common columns FROM "tablename"
   * 5. DROP TABLE "tablename"
   * 6. ALTER TABLE "_new_tablename" RENAME TO "tablename"
   * 7. Recreate all indexes
   * 8. COMMIT
   * 9. PRAGMA foreign_keys = ON (after transaction)
   * 10. PRAGMA foreign_key_check (after re-enabling FKs)
   */
  private executeRecreateTable = (
    client: SqliteQueryClient,
    op: Extract<SqliteSyncOperation, { type: "recreate_table" }>,
    executedSql: Array<string>,
  ): void => {
    const { tableName, newDdl, copyColumns, newIndexesDdl } = op;
    const quotedTable = quoteIdentifier(tableName);
    const quotedTempTable = quoteIdentifier(`_new_${tableName}`);

    this.logger?.debug(`Recreating table ${quotedTable}`);

    try {
      // Disable FK checks BEFORE the transaction — PRAGMA foreign_keys has no
      // effect inside a multi-statement transaction.
      client.exec("PRAGMA foreign_keys = OFF");
      executedSql.push("PRAGMA foreign_keys = OFF");

      client.exec("BEGIN EXCLUSIVE");

      // Create the new table with temporary name
      client.exec(newDdl);
      executedSql.push(newDdl);

      // Copy data from old table to new table
      if (copyColumns.length > 0) {
        const cols = copyColumns.map(quoteIdentifier).join(", ");
        const insertSql = `INSERT INTO ${quotedTempTable} (${cols}) SELECT ${cols} FROM ${quotedTable};`;
        client.exec(insertSql);
        executedSql.push(insertSql);
      }

      // Drop old table
      const dropSql = `DROP TABLE ${quotedTable};`;
      client.exec(dropSql);
      executedSql.push(dropSql);

      // Rename new table to old name
      const renameSql = `ALTER TABLE ${quotedTempTable} RENAME TO ${quotedTable};`;
      client.exec(renameSql);
      executedSql.push(renameSql);

      // Recreate indexes
      for (const indexDdl of newIndexesDdl) {
        client.exec(indexDdl);
        executedSql.push(indexDdl);
      }

      client.exec("COMMIT");

      // Re-enable FK checks AFTER the transaction
      client.exec("PRAGMA foreign_keys = ON");
      executedSql.push("PRAGMA foreign_keys = ON");

      // Verify FK integrity after re-enabling FKs (unquoted table name per PRAGMA syntax)
      const fkCheckSql = `PRAGMA foreign_key_check(${tableName})`;
      const violations = client.all(fkCheckSql);
      if (violations.length > 0) {
        throw new SqliteSyncError(
          `Foreign key violations detected after recreating table "${tableName}": ${violations.length} violation(s)`,
        );
      }
      executedSql.push(fkCheckSql);
    } catch (error) {
      try {
        client.exec("ROLLBACK");
      } catch {
        // ROLLBACK failure is secondary
      }

      // Re-enable FK checks even on failure
      try {
        client.exec("PRAGMA foreign_keys = ON");
      } catch {
        // Best effort
      }

      if (error instanceof SqliteSyncError) throw error;
      throw new SqliteSyncError(`Recreate table "${tableName}" failed`, {
        error: error as Error,
      });
    }
  };

  /**
   * Topologically sorts create_table operations by FK dependency order (Kahn's algorithm).
   * Tables that are depended upon are created first. Non-create_table operations
   * retain their original relative order.
   */
  private topologicallySortCreateTables = (
    ops: Array<SqliteSyncOperation>,
  ): Array<SqliteSyncOperation> => {
    const createOps: Array<Extract<SqliteSyncOperation, { type: "create_table" }>> = [];
    const otherOps: Array<{ op: SqliteSyncOperation; originalIndex: number }> = [];

    for (let i = 0; i < ops.length; i++) {
      const op = ops[i];
      if (op.type === "create_table") {
        createOps.push(op);
      } else {
        otherOps.push({ op, originalIndex: i });
      }
    }

    if (createOps.length <= 1) return ops;

    // Build set of table names being created in this batch
    const creatingSet = new Set(createOps.map((op) => op.tableName));

    // Build adjacency list and in-degree map (only for deps within the batch)
    const inDegree = new Map<string, number>();
    const dependents = new Map<string, Array<string>>();

    for (const op of createOps) {
      inDegree.set(op.tableName, 0);
      dependents.set(op.tableName, []);
    }

    for (const op of createOps) {
      for (const dep of op.foreignTableDeps) {
        if (!creatingSet.has(dep)) continue; // dep already exists, not in this batch
        inDegree.set(op.tableName, (inDegree.get(op.tableName) ?? 0) + 1);
        dependents.get(dep)!.push(op.tableName);
      }
    }

    // Kahn's algorithm
    const queue: Array<string> = [];
    for (const [name, degree] of inDegree) {
      if (degree === 0) queue.push(name);
    }

    const sorted: Array<string> = [];
    while (queue.length > 0) {
      const current = queue.shift()!;
      sorted.push(current);

      for (const dependent of dependents.get(current) ?? []) {
        const newDegree = (inDegree.get(dependent) ?? 1) - 1;
        inDegree.set(dependent, newDegree);
        if (newDegree === 0) queue.push(dependent);
      }
    }

    if (sorted.length !== createOps.length) {
      const unsorted = createOps
        .filter((op) => !sorted.includes(op.tableName))
        .map((op) => op.tableName);
      throw new SqliteSyncError(
        `Circular foreign key dependency detected among tables: ${unsorted.join(", ")}. ` +
          `Cannot determine creation order.`,
      );
    }

    // Rebuild ops array: sorted create_table ops first, then other ops in original order
    const createOpMap = new Map(createOps.map((op) => [op.tableName, op]));
    const result: Array<SqliteSyncOperation> = [];

    for (const name of sorted) {
      result.push(createOpMap.get(name)!);
    }

    for (const { op } of otherOps.sort((a, b) => a.originalIndex - b.originalIndex)) {
      result.push(op);
    }

    return result;
  };

  private getOperationSql = (op: SqliteSyncOperation): string => {
    switch (op.type) {
      case "create_table":
        return op.ddl;
      case "add_column":
        return op.ddl;
      case "create_index":
        return op.ddl;
      case "drop_index":
        return `DROP INDEX IF EXISTS ${quoteIdentifier(op.indexName)};`;
      case "drop_table":
        return `DROP TABLE IF EXISTS ${quoteIdentifier(op.tableName)};`;
      case "recreate_table":
        // Handled separately
        return "";
    }
  };

  private describeOperation = (op: SqliteSyncOperation): string => {
    switch (op.type) {
      case "create_table":
        return `Create table "${op.tableName}"`;
      case "add_column":
        return `Add column on "${op.tableName}"`;
      case "create_index":
        return `Create index`;
      case "drop_index":
        return `Drop index "${op.indexName}"`;
      case "drop_table":
        return `Drop table "${op.tableName}"`;
      case "recreate_table":
        return `Recreate table "${op.tableName}"`;
    }
  };

  private logPlan = (plan: SqliteSyncPlan): void => {
    if (!this.logger) return;

    this.logger.info(`Dry-run sync plan: ${plan.operations.length} operation(s)`);

    for (const op of plan.operations) {
      this.logger.debug(this.describeOperation(op));
    }
  };
}
