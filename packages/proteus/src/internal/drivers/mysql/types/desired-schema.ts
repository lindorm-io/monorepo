export type MysqlDesiredColumn = {
  name: string;
  mysqlType: string; // VARCHAR(255), INT, BIGINT, JSON, DATETIME(3), etc.
  nullable: boolean;
  defaultExpr: string | null;
  isAutoIncrement: boolean;
  enumValues: Array<string> | null; // ENUM('a','b','c') values
  computed?: string | null;
};

export type MysqlDesiredIndex = {
  name: string;
  unique: boolean;
  columns: Array<{
    name: string;
    direction: "asc" | "desc";
    prefixLength: number | null;
  }>;
};

export type MysqlDesiredForeignKey = {
  constraintName: string;
  columns: Array<string>;
  foreignTable: string;
  foreignColumns: Array<string>;
  onDelete: string;
  onUpdate: string;
};

export type MysqlDesiredCheck = {
  name: string;
  expression: string;
};

export type MysqlDesiredUnique = {
  name: string;
  columns: Array<{ name: string; prefixLength: number | null }>;
};

export type MysqlDesiredTable = {
  name: string;
  columns: Array<MysqlDesiredColumn>;
  primaryKeys: Array<string>;
  foreignKeys: Array<MysqlDesiredForeignKey>;
  uniqueConstraints: Array<MysqlDesiredUnique>;
  checkConstraints: Array<MysqlDesiredCheck>;
  indexes: Array<MysqlDesiredIndex>;
};

export type MysqlDesiredSchema = {
  tables: Array<MysqlDesiredTable>;
};
