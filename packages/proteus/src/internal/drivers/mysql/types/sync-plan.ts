export type MysqlSyncOperation =
  | {
      type: "create_table";
      tableName: string;
      sql: string;
      foreignTableDeps: Array<string>;
    }
  | { type: "add_column"; tableName: string; sql: string }
  | { type: "modify_column"; tableName: string; columnName: string; sql: string }
  | { type: "drop_column"; tableName: string; columnName: string; sql: string }
  | { type: "add_index"; tableName: string; indexName: string; sql: string }
  | { type: "drop_index"; tableName: string; indexName: string; sql: string }
  | { type: "add_fk"; tableName: string; constraintName: string; sql: string }
  | { type: "drop_fk"; tableName: string; constraintName: string; sql: string }
  | { type: "add_check"; tableName: string; constraintName: string; sql: string }
  | { type: "add_unique"; tableName: string; constraintName: string; sql: string }
  | { type: "drop_constraint"; tableName: string; constraintName: string; sql: string };

export type MysqlSyncPlan = {
  operations: Array<MysqlSyncOperation>;
};

export type MysqlSyncOptions = {
  dryRun?: boolean;
  /** When true, skip advisory lock acquire/release (caller already holds the lock) */
  skipLock?: boolean;
};

export type MysqlSyncResult = {
  plan: MysqlSyncPlan;
  executed: boolean;
  statementsExecuted: number;
  executedSql: Array<string>;
};
