export type SqliteDesiredColumn = {
  name: string;
  sqliteType: string; // TEXT, INTEGER, REAL, NUMERIC, BLOB
  nullable: boolean;
  defaultExpr: string | null;
  isAutoincrement: boolean; // INTEGER PRIMARY KEY AUTOINCREMENT
  checkExpr: string | null; // inline CHECK constraint for enum columns
};

export type SqliteDesiredIndex = {
  name: string;
  unique: boolean;
  columns: Array<{ name: string; direction: "asc" | "desc" }>;
  where: string | null; // partial index WHERE clause
};

export type SqliteDesiredForeignKey = {
  columns: Array<string>;
  foreignTable: string;
  foreignColumns: Array<string>;
  onDelete: string;
  onUpdate: string;
};

export type SqliteDesiredUnique = {
  name: string;
  columns: Array<string>;
};

export type SqliteDesiredTable = {
  name: string;
  columns: Array<SqliteDesiredColumn>;
  primaryKeys: Array<string>;
  foreignKeys: Array<SqliteDesiredForeignKey>;
  uniqueConstraints: Array<SqliteDesiredUnique>;
  checkConstraints: Array<string>; // CHECK (expr)
  indexes: Array<SqliteDesiredIndex>;
};

export type SqliteDesiredSchema = {
  tables: Array<SqliteDesiredTable>;
};
