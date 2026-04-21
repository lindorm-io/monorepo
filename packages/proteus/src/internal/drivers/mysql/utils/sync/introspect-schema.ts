import type { MysqlQueryClient } from "../../types/mysql-query-client.js";
import type {
  MysqlDbSnapshot,
  MysqlSnapshotColumn,
  MysqlSnapshotCheck,
  MysqlSnapshotForeignKey,
  MysqlSnapshotIndex,
  MysqlSnapshotTable,
  MysqlSnapshotUnique,
} from "../../types/db-snapshot.js";

type ColumnRow = {
  COLUMN_NAME: string;
  DATA_TYPE: string;
  COLUMN_TYPE: string;
  IS_NULLABLE: string;
  COLUMN_DEFAULT: string | null;
  CHARACTER_MAXIMUM_LENGTH: number | null;
  NUMERIC_PRECISION: number | null;
  NUMERIC_SCALE: number | null;
  EXTRA: string;
  ORDINAL_POSITION: number;
  TABLE_NAME: string;
};

type IndexRow = {
  INDEX_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  NON_UNIQUE: number;
  SEQ_IN_INDEX: number;
  INDEX_TYPE: string;
  SUB_PART: number | null;
  COLLATION: string | null;
};

type FkRow = {
  CONSTRAINT_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  REFERENCED_TABLE_NAME: string;
  REFERENCED_COLUMN_NAME: string;
  DELETE_RULE: string;
  UPDATE_RULE: string;
};

type UniqueRow = {
  CONSTRAINT_NAME: string;
  TABLE_NAME: string;
  COLUMN_NAME: string;
  ORDINAL_POSITION: number;
  SUB_PART: number | null;
};

type CheckRow = {
  CONSTRAINT_NAME: string;
  CHECK_CLAUSE: string;
  TABLE_NAME: string;
};

type TableNameRow = {
  TABLE_NAME: string;
};

/**
 * Introspects the MySQL database schema by querying information_schema.
 *
 * @param client - The MySQL query client.
 * @param managedTableNames - If provided, only introspect these table names.
 *   If empty or not provided, introspects all user tables.
 * @returns A `MysqlDbSnapshot` mapping table names to their introspected state.
 */
export const introspectSchema = async (
  client: MysqlQueryClient,
  managedTableNames?: Array<string>,
): Promise<MysqlDbSnapshot> => {
  const tables = new Map<string, MysqlSnapshotTable>();

  // List all tables in the current database
  const { rows: tableRows } = await client.query<TableNameRow>(
    `SELECT TABLE_NAME FROM information_schema.TABLES
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_TYPE = 'BASE TABLE'
     ORDER BY TABLE_NAME`,
  );

  const managedSet = managedTableNames ? new Set(managedTableNames) : null;

  const relevantTableNames: Array<string> = [];
  for (const row of tableRows) {
    const name = row.TABLE_NAME;
    if (managedSet && !managedSet.has(name)) continue;
    relevantTableNames.push(name);
    tables.set(name, {
      name,
      columns: [],
      indexes: [],
      foreignKeys: [],
      checkConstraints: [],
      uniqueConstraints: [],
      triggers: [],
    });
  }

  if (relevantTableNames.length === 0) {
    return { tables };
  }

  // Batch-query columns for all relevant tables
  const { rows: columnRows } = await client.query<ColumnRow>(
    `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT,
            CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE,
            EXTRA, ORDINAL_POSITION, TABLE_NAME
     FROM information_schema.COLUMNS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)
     ORDER BY TABLE_NAME, ORDINAL_POSITION`,
    [relevantTableNames],
  );

  for (const row of columnRows) {
    const table = tables.get(row.TABLE_NAME);
    if (!table) continue;

    const col: MysqlSnapshotColumn = {
      name: row.COLUMN_NAME,
      dataType: row.DATA_TYPE.toLowerCase(),
      columnType: row.COLUMN_TYPE.toLowerCase(),
      nullable: row.IS_NULLABLE === "YES",
      defaultValue: row.COLUMN_DEFAULT,
      maxLength: row.CHARACTER_MAXIMUM_LENGTH,
      numericPrecision: row.NUMERIC_PRECISION,
      numericScale: row.NUMERIC_SCALE,
      extra: row.EXTRA.toLowerCase(),
      ordinalPosition: row.ORDINAL_POSITION,
    };
    table.columns.push(col);
  }

  // Batch-query indexes (excluding PRIMARY)
  const { rows: indexRows } = await client.query<IndexRow>(
    `SELECT INDEX_NAME, TABLE_NAME, COLUMN_NAME, NON_UNIQUE, SEQ_IN_INDEX,
            INDEX_TYPE, SUB_PART, COLLATION
     FROM information_schema.STATISTICS
     WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (?)
       AND INDEX_NAME != 'PRIMARY'
     ORDER BY TABLE_NAME, INDEX_NAME, SEQ_IN_INDEX`,
    [relevantTableNames],
  );

  // Group index rows by table + index name
  const indexGroups = new Map<string, Array<IndexRow>>();
  for (const row of indexRows) {
    const key = `${row.TABLE_NAME}::${row.INDEX_NAME}`;
    if (!indexGroups.has(key)) indexGroups.set(key, []);
    indexGroups.get(key)!.push(row);
  }

  for (const [key, rows] of indexGroups) {
    const tableName = key.split("::")[0];
    const table = tables.get(tableName);
    if (!table) continue;

    const sorted = rows.sort((a, b) => a.SEQ_IN_INDEX - b.SEQ_IN_INDEX);
    const idx: MysqlSnapshotIndex = {
      name: sorted[0].INDEX_NAME,
      unique: sorted[0].NON_UNIQUE === 0,
      indexType: sorted[0].INDEX_TYPE,
      columns: sorted.map((r) => ({
        name: r.COLUMN_NAME,
        seq: r.SEQ_IN_INDEX,
        subPart: r.SUB_PART,
        direction: r.COLLATION === "D" ? "desc" : "asc",
      })),
    };
    table.indexes.push(idx);
  }

  // Batch-query foreign keys
  const { rows: fkRows } = await client.query<FkRow>(
    `SELECT tc.CONSTRAINT_NAME, tc.TABLE_NAME, kcu.COLUMN_NAME,
            kcu.REFERENCED_TABLE_NAME, kcu.REFERENCED_COLUMN_NAME,
            rc.DELETE_RULE, rc.UPDATE_RULE
     FROM information_schema.TABLE_CONSTRAINTS tc
     JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
       AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
       AND tc.TABLE_NAME = kcu.TABLE_NAME
     JOIN information_schema.REFERENTIAL_CONSTRAINTS rc
       ON tc.CONSTRAINT_NAME = rc.CONSTRAINT_NAME
       AND tc.TABLE_SCHEMA = rc.CONSTRAINT_SCHEMA
     WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME IN (?)
       AND tc.CONSTRAINT_TYPE = 'FOREIGN KEY'`,
    [relevantTableNames],
  );

  // Group FK rows by table + constraint name
  const fkGroups = new Map<string, Array<FkRow>>();
  for (const row of fkRows) {
    const key = `${row.TABLE_NAME}::${row.CONSTRAINT_NAME}`;
    if (!fkGroups.has(key)) fkGroups.set(key, []);
    fkGroups.get(key)!.push(row);
  }

  for (const [key, rows] of fkGroups) {
    const tableName = key.split("::")[0];
    const table = tables.get(tableName);
    if (!table) continue;

    const first = rows[0];
    const fk: MysqlSnapshotForeignKey = {
      constraintName: first.CONSTRAINT_NAME,
      columns: rows.map((r) => r.COLUMN_NAME),
      referencedTable: first.REFERENCED_TABLE_NAME,
      referencedColumns: rows.map((r) => r.REFERENCED_COLUMN_NAME),
      deleteRule: first.DELETE_RULE,
      updateRule: first.UPDATE_RULE,
    };
    table.foreignKeys.push(fk);
  }

  // Filter out FK-backing indexes from each table.
  // MySQL auto-creates an index for FK columns; its name matches the FK constraint name.
  // These are not user-managed and should not appear in the diff.
  for (const [, table] of tables) {
    const fkNames = new Set(
      table.foreignKeys.map((fk) => fk.constraintName.toLowerCase()),
    );
    if (fkNames.size > 0) {
      table.indexes = table.indexes.filter((idx) => !fkNames.has(idx.name.toLowerCase()));
    }
  }

  // Batch-query unique constraints (join with STATISTICS for SUB_PART/prefix lengths)
  const { rows: uniqueRows } = await client.query<UniqueRow>(
    `SELECT tc.CONSTRAINT_NAME, kcu.TABLE_NAME, kcu.COLUMN_NAME, kcu.ORDINAL_POSITION,
            s.SUB_PART
     FROM information_schema.TABLE_CONSTRAINTS tc
     JOIN information_schema.KEY_COLUMN_USAGE kcu
       ON tc.CONSTRAINT_NAME = kcu.CONSTRAINT_NAME
       AND tc.TABLE_SCHEMA = kcu.TABLE_SCHEMA
       AND tc.TABLE_NAME = kcu.TABLE_NAME
     LEFT JOIN information_schema.STATISTICS s
       ON s.TABLE_SCHEMA = tc.TABLE_SCHEMA
       AND s.TABLE_NAME = tc.TABLE_NAME
       AND s.INDEX_NAME = tc.CONSTRAINT_NAME
       AND s.COLUMN_NAME = kcu.COLUMN_NAME
     WHERE tc.TABLE_SCHEMA = DATABASE() AND tc.TABLE_NAME IN (?)
       AND tc.CONSTRAINT_TYPE = 'UNIQUE'
     ORDER BY tc.CONSTRAINT_NAME, kcu.ORDINAL_POSITION`,
    [relevantTableNames],
  );

  // Group unique rows by table + constraint name
  const uniqueGroups = new Map<string, Array<UniqueRow>>();
  for (const row of uniqueRows) {
    const key = `${row.TABLE_NAME}::${row.CONSTRAINT_NAME}`;
    if (!uniqueGroups.has(key)) uniqueGroups.set(key, []);
    uniqueGroups.get(key)!.push(row);
  }

  for (const [key, rows] of uniqueGroups) {
    const tableName = key.split("::")[0];
    const table = tables.get(tableName);
    if (!table) continue;

    const sorted = rows.sort((a, b) => a.ORDINAL_POSITION - b.ORDINAL_POSITION);
    const uq: MysqlSnapshotUnique = {
      constraintName: sorted[0].CONSTRAINT_NAME,
      columns: sorted.map((r) => ({
        name: r.COLUMN_NAME,
        ordinalPosition: r.ORDINAL_POSITION,
        subPart: r.SUB_PART ?? null,
      })),
    };
    table.uniqueConstraints.push(uq);
  }

  // Batch-query check constraints (MySQL 8.0.16+)
  const { rows: checkRows } = await client.query<CheckRow>(
    `SELECT cc.CONSTRAINT_NAME, cc.CHECK_CLAUSE, tc.TABLE_NAME
     FROM information_schema.CHECK_CONSTRAINTS cc
     JOIN information_schema.TABLE_CONSTRAINTS tc
       ON cc.CONSTRAINT_NAME = tc.CONSTRAINT_NAME
       AND cc.CONSTRAINT_SCHEMA = tc.TABLE_SCHEMA
     WHERE cc.CONSTRAINT_SCHEMA = DATABASE() AND tc.TABLE_NAME IN (?)`,
    [relevantTableNames],
  );

  for (const row of checkRows) {
    const table = tables.get(row.TABLE_NAME);
    if (!table) continue;

    const chk: MysqlSnapshotCheck = {
      constraintName: row.CONSTRAINT_NAME,
      checkClause: row.CHECK_CLAUSE,
    };
    table.checkConstraints.push(chk);
  }

  // Batch-query triggers (only proteus-managed triggers)
  const { rows: triggerRows } = await client.query<{
    TRIGGER_NAME: string;
    EVENT_OBJECT_TABLE: string;
  }>(
    `SELECT TRIGGER_NAME, EVENT_OBJECT_TABLE
     FROM information_schema.TRIGGERS
     WHERE TRIGGER_SCHEMA = DATABASE() AND EVENT_OBJECT_TABLE IN (?)
       AND TRIGGER_NAME LIKE 'proteus_%'
     ORDER BY EVENT_OBJECT_TABLE, TRIGGER_NAME`,
    [relevantTableNames],
  );

  for (const row of triggerRows) {
    const table = tables.get(row.EVENT_OBJECT_TABLE);
    if (!table) continue;
    table.triggers.push({ name: row.TRIGGER_NAME });
  }

  return { tables };
};
