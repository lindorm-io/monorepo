export type SyncOperationType =
  | "create_extension"
  | "create_schema"
  | "create_enum"
  | "add_enum_value"
  | "create_table"
  | "add_column"
  | "drop_column"
  | "alter_column_type"
  | "alter_column_nullable"
  | "alter_column_default"
  | "alter_column_identity"
  | "drop_and_readd_column"
  | "backfill_column"
  | "add_constraint"
  | "drop_constraint"
  | "create_index"
  | "drop_index"
  | "set_comment"
  | "create_trigger"
  | "drop_trigger"
  | "warn_only";

export type SyncSeverity = "safe" | "warning" | "destructive";

export type SyncOperation = {
  type: SyncOperationType;
  severity: SyncSeverity;
  schema: string | null;
  table: string | null;
  description: string;
  sql: string;
  autocommit: boolean;
  constraintType?: "PRIMARY KEY" | "UNIQUE" | "FOREIGN KEY" | "CHECK";
};

export type SyncPlan = {
  operations: Array<SyncOperation>;
  summary: {
    safe: number;
    warning: number;
    destructive: number;
    total: number;
  };
};

export type SyncOptions = {
  dryRun?: boolean;
};

export type SyncResult = {
  plan: SyncPlan;
  executed: boolean;
  statementsExecuted: number;
  executedSql: Array<string>;
  failedOperations: Array<{ operation: SyncOperation; error: Error }>;
};
