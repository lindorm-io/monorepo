export type MysqlSnapshotColumn = {
  name: string;
  dataType: string; // e.g. "varchar", "int", "datetime"
  columnType: string; // e.g. "varchar(255)", "int", "enum('a','b')", "datetime(3)"
  nullable: boolean;
  defaultValue: string | null;
  maxLength: number | null;
  numericPrecision: number | null;
  numericScale: number | null;
  extra: string; // e.g. "auto_increment", "STORED GENERATED"
  ordinalPosition: number;
};

export type MysqlSnapshotIndex = {
  name: string;
  columns: Array<{
    name: string;
    seq: number;
    subPart: number | null;
    direction: "asc" | "desc";
  }>;
  unique: boolean;
  indexType: string; // BTREE, HASH, FULLTEXT
};

export type MysqlSnapshotForeignKey = {
  constraintName: string;
  columns: string[];
  referencedTable: string;
  referencedColumns: string[];
  deleteRule: string;
  updateRule: string;
};

export type MysqlSnapshotCheck = {
  constraintName: string;
  checkClause: string;
};

export type MysqlSnapshotUnique = {
  constraintName: string;
  columns: Array<{ name: string; ordinalPosition: number; subPart: number | null }>;
};

export type MysqlSnapshotTrigger = {
  name: string;
};

export type MysqlSnapshotTable = {
  name: string;
  columns: Array<MysqlSnapshotColumn>;
  indexes: Array<MysqlSnapshotIndex>;
  foreignKeys: Array<MysqlSnapshotForeignKey>;
  checkConstraints: Array<MysqlSnapshotCheck>;
  uniqueConstraints: Array<MysqlSnapshotUnique>;
  triggers: Array<MysqlSnapshotTrigger>;
};

export type MysqlDbSnapshot = {
  tables: Map<string, MysqlSnapshotTable>;
};
