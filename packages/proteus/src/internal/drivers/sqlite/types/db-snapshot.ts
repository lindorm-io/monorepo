export type SqliteSnapshotColumn = {
  cid: number;
  name: string;
  type: string;
  notNull: boolean;
  defaultValue: string | null;
  pk: number; // 0 = not PK, 1+ = PK position
};

export type SqliteSnapshotForeignKey = {
  id: number;
  seq: number;
  table: string;
  from: string;
  to: string;
  onUpdate: string;
  onDelete: string;
};

export type SqliteSnapshotIndex = {
  name: string;
  unique: boolean;
  origin: string; // "c" = CREATE INDEX, "u" = UNIQUE constraint, "pk" = PRIMARY KEY
  partial: boolean;
  columns: Array<SqliteSnapshotIndexColumn>;
};

export type SqliteSnapshotIndexColumn = {
  seqno: number;
  cid: number;
  name: string;
};

export type SqliteSnapshotTable = {
  name: string;
  columns: Array<SqliteSnapshotColumn>;
  foreignKeys: Array<SqliteSnapshotForeignKey>;
  indexes: Array<SqliteSnapshotIndex>;
  sql: string; // original CREATE TABLE statement from sqlite_master
};

export type SqliteDbSnapshot = {
  tables: Map<string, SqliteSnapshotTable>;
};
