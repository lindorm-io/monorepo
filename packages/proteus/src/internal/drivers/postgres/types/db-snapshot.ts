export type DbColumn = {
  name: string;
  type: string;
  nullable: boolean;
  defaultExpr: string | null;
  isIdentity: boolean;
  identityGeneration: "ALWAYS" | "BY DEFAULT" | null;
  isGenerated: boolean;
  generationExpr: string | null;
  collation: string | null;
};

export type DbConstraint = {
  name: string;
  type: "PRIMARY KEY" | "UNIQUE" | "FOREIGN KEY" | "CHECK";
  columns: Array<string>;
  foreignSchema: string | null;
  foreignTable: string | null;
  foreignColumns: Array<string> | null;
  onDelete: string | null;
  onUpdate: string | null;
  checkExpr: string | null;
  deferrable: boolean;
  initiallyDeferred: boolean;
};

export type DbIndex = {
  name: string;
  unique: boolean;
  columns: Array<{ name: string; direction: "asc" | "desc" }>;
  method: string;
  where: string | null;
  include: Array<string>;
};

export type DbEnum = {
  schema: string;
  name: string;
  values: Array<string>;
};

export type DbTrigger = {
  /** Trigger name (unquoted) */
  name: string;
};

export type DbTable = {
  schema: string;
  name: string;
  columns: Array<DbColumn>;
  constraints: Array<DbConstraint>;
  indexes: Array<DbIndex>;
  comment: string | null;
  columnComments: Record<string, string>;
  triggers: Array<DbTrigger>;
};

export type DbSnapshot = {
  tables: Array<DbTable>;
  enums: Array<DbEnum>;
  schemas: Array<string>;
};
