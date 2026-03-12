export type DesiredColumn = {
  name: string;
  pgType: string;
  nullable: boolean;
  defaultExpr: string | null;
  isIdentity: boolean;
  identityGeneration: "ALWAYS" | "BY DEFAULT" | null;
  isGenerated: boolean;
  generationExpr: string | null;
  collation: string | null;
};

export type DesiredConstraint = {
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

export type DesiredIndex = {
  name: string;
  unique: boolean;
  columns: Array<{ name: string; direction: "asc" | "desc" }>;
  method: string;
  where: string | null;
  include: Array<string> | null;
  concurrent: boolean;
};

export type DesiredEnum = {
  schema: string;
  name: string;
  values: Array<string>;
};

export type DesiredTable = {
  schema: string;
  name: string;
  columns: Array<DesiredColumn>;
  constraints: Array<DesiredConstraint>;
  indexes: Array<DesiredIndex>;
  comment: string | null;
  columnComments: Record<string, string>;
};

export type DesiredSchema = {
  tables: Array<DesiredTable>;
  enums: Array<DesiredEnum>;
  schemas: Array<string>;
  extensions: Array<string>;
};
