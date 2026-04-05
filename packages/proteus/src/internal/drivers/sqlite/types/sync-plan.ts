export type SqliteSyncOperation =
  | {
      type: "create_table";
      tableName: string;
      ddl: string;
      foreignTableDeps: Array<string>;
    }
  | {
      type: "recreate_table";
      tableName: string;
      newDdl: string;
      copyColumns: Array<string>;
      newIndexesDdl: Array<string>;
    }
  | { type: "add_column"; tableName: string; ddl: string }
  | { type: "create_index"; ddl: string }
  | { type: "drop_index"; indexName: string }
  | { type: "drop_table"; tableName: string }
  | { type: "create_trigger"; triggerName: string; ddl: string }
  | { type: "drop_trigger"; triggerName: string };

export type SqliteSyncPlan = {
  operations: Array<SqliteSyncOperation>;
};

export type SqliteSyncOptions = {
  dryRun?: boolean;
};

export type SqliteSyncResult = {
  plan: SqliteSyncPlan;
  executed: boolean;
  statementsExecuted: number;
  executedSql: Array<string>;
};
