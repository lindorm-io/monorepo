import type {
  SqliteDesiredSchema,
  SqliteDesiredTable,
  SqliteDesiredColumn,
  SqliteDesiredIndex,
} from "../../types/desired-schema";
import type {
  SqliteDbSnapshot,
  SqliteSnapshotTable,
  SqliteSnapshotIndex,
} from "../../types/db-snapshot";
import type { SqliteSyncOperation, SqliteSyncPlan } from "../../types/sync-plan";
import { quoteIdentifier } from "../quote-identifier";

/**
 * Renders a full CREATE TABLE DDL from a desired table definition.
 * Used for both new table creation and recreate-table operations.
 */
const renderCreateTableDDL = (table: SqliteDesiredTable): string => {
  const lines: Array<string> = [];

  // Check if single PK with autoincrement
  const isAutoincrement =
    table.primaryKeys.length === 1 &&
    table.columns.some((c) => c.name === table.primaryKeys[0] && c.isAutoincrement);

  // Columns
  for (const col of table.columns) {
    let def = quoteIdentifier(col.name);
    def += ` ${col.sqliteType}`;

    if (isAutoincrement && col.name === table.primaryKeys[0]) {
      def += " PRIMARY KEY AUTOINCREMENT";
    } else {
      if (col.defaultExpr) def += ` DEFAULT ${col.defaultExpr}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.checkExpr) def += ` ${col.checkExpr}`;
    }

    lines.push(def);
  }

  // Primary key (non-autoincrement)
  if (!isAutoincrement) {
    const pkCols = table.primaryKeys.map(quoteIdentifier).join(", ");
    lines.push(`PRIMARY KEY (${pkCols})`);
  }

  // Inline FK constraints
  for (const fk of table.foreignKeys) {
    const cols = fk.columns.map(quoteIdentifier).join(", ");
    const refCols = fk.foreignColumns.map(quoteIdentifier).join(", ");
    lines.push(
      `FOREIGN KEY (${cols}) REFERENCES ${quoteIdentifier(fk.foreignTable)}` +
        ` (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
    );
  }

  // Check constraints
  for (const check of table.checkConstraints) {
    lines.push(check);
  }

  // Unique constraints
  for (const unique of table.uniqueConstraints) {
    const cols = unique.columns.map(quoteIdentifier).join(", ");
    lines.push(`CONSTRAINT ${quoteIdentifier(unique.name)} UNIQUE (${cols})`);
  }

  const body = lines.map((l) => `  ${l}`).join(",\n");
  return `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (\n${body}\n);`;
};

/**
 * Renders a CREATE TABLE DDL *without* IF NOT EXISTS for use in recreate-table.
 * The temp table needs a plain CREATE TABLE.
 */
const renderCreateTableDDLForRecreate = (
  tempTableName: string,
  table: SqliteDesiredTable,
): string => {
  const lines: Array<string> = [];

  const isAutoincrement =
    table.primaryKeys.length === 1 &&
    table.columns.some((c) => c.name === table.primaryKeys[0] && c.isAutoincrement);

  for (const col of table.columns) {
    let def = quoteIdentifier(col.name);
    def += ` ${col.sqliteType}`;

    if (isAutoincrement && col.name === table.primaryKeys[0]) {
      def += " PRIMARY KEY AUTOINCREMENT";
    } else {
      if (col.defaultExpr) def += ` DEFAULT ${col.defaultExpr}`;
      if (!col.nullable) def += " NOT NULL";
      if (col.checkExpr) def += ` ${col.checkExpr}`;
    }

    lines.push(def);
  }

  if (!isAutoincrement) {
    const pkCols = table.primaryKeys.map(quoteIdentifier).join(", ");
    lines.push(`PRIMARY KEY (${pkCols})`);
  }

  for (const fk of table.foreignKeys) {
    const cols = fk.columns.map(quoteIdentifier).join(", ");
    const refCols = fk.foreignColumns.map(quoteIdentifier).join(", ");
    lines.push(
      `FOREIGN KEY (${cols}) REFERENCES ${quoteIdentifier(fk.foreignTable)}` +
        ` (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
    );
  }

  for (const check of table.checkConstraints) {
    lines.push(check);
  }

  for (const unique of table.uniqueConstraints) {
    const cols = unique.columns.map(quoteIdentifier).join(", ");
    lines.push(`CONSTRAINT ${quoteIdentifier(unique.name)} UNIQUE (${cols})`);
  }

  const body = lines.map((l) => `  ${l}`).join(",\n");
  return `CREATE TABLE ${quoteIdentifier(tempTableName)} (\n${body}\n);`;
};

/**
 * Renders index DDL statements for a desired table.
 */
const renderIndexDDL = (table: SqliteDesiredTable): Array<string> => {
  const statements: Array<string> = [];

  for (const idx of table.indexes) {
    const unique = idx.unique ? "UNIQUE " : "";
    const cols = idx.columns
      .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
      .join(", ");

    let stmt = `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(idx.name)} ON ${quoteIdentifier(table.name)} (${cols})`;
    if (idx.where) stmt += ` WHERE ${idx.where}`;
    statements.push(stmt + ";");
  }

  return statements;
};

/**
 * Determines if adding columns to an existing table is safe via ALTER TABLE ADD COLUMN.
 *
 * Safe when: only new columns are being added (no removals, no type changes, no constraint
 * changes), and all new columns are either nullable or have a default value.
 */
const canUseAddColumn = (
  existingTable: SqliteSnapshotTable,
  desiredTable: SqliteDesiredTable,
): { safe: boolean; newColumns: Array<SqliteDesiredColumn> } => {
  const existingColNames = new Set(existingTable.columns.map((c) => c.name));
  const desiredColNames = new Set(desiredTable.columns.map((c) => c.name));

  // Any removed columns? Not safe for ADD COLUMN
  for (const name of existingColNames) {
    if (!desiredColNames.has(name)) {
      return { safe: false, newColumns: [] };
    }
  }

  // Any existing columns changed? Check type, nullability, default
  for (const existingCol of existingTable.columns) {
    const desiredCol = desiredTable.columns.find((c) => c.name === existingCol.name);
    if (!desiredCol) return { safe: false, newColumns: [] };

    // Type change
    if (normalizeType(existingCol.type) !== normalizeType(desiredCol.sqliteType)) {
      return { safe: false, newColumns: [] };
    }

    // Nullability change
    if (existingCol.notNull !== !desiredCol.nullable) {
      return { safe: false, newColumns: [] };
    }

    // Default value change (compare normalized)
    if (
      normalizeDefault(existingCol.defaultValue) !==
      normalizeDefault(desiredCol.defaultExpr)
    ) {
      return { safe: false, newColumns: [] };
    }
  }

  // Check PK changes — if PKs differ, need recreate
  const existingPks = existingTable.columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
  if (existingPks.join(",") !== desiredTable.primaryKeys.join(",")) {
    return { safe: false, newColumns: [] };
  }

  // Check FK changes — compare normalized FK lists
  const existingFkStr = normalizeFks(existingTable);
  const desiredFkStr = desiredTable.foreignKeys
    .map(
      (fk) =>
        `${fk.columns.join(",")}->${fk.foreignTable}(${fk.foreignColumns.join(",")})`,
    )
    .sort()
    .join("|");
  if (existingFkStr !== desiredFkStr) {
    return { safe: false, newColumns: [] };
  }

  // Check unique constraint changes
  const existingUniqueStr = normalizeUniqueConstraints(existingTable);
  const desiredUniqueStr = desiredTable.uniqueConstraints
    .map((u) => `${u.name}:${u.columns.join(",")}`)
    .sort()
    .join("|");
  if (existingUniqueStr !== desiredUniqueStr) {
    return { safe: false, newColumns: [] };
  }

  // New columns
  const newColumns = desiredTable.columns.filter((c) => !existingColNames.has(c.name));

  // All new columns must be nullable or have a default
  for (const col of newColumns) {
    if (!col.nullable && col.defaultExpr === null) {
      return { safe: false, newColumns: [] };
    }
  }

  return { safe: newColumns.length > 0, newColumns };
};

const normalizeType = (type: string): string => type.toUpperCase().trim();

const normalizeDefault = (expr: string | null): string => {
  if (expr === null || expr === undefined) return "";
  return expr.trim();
};

const normalizeFks = (table: SqliteSnapshotTable): string => {
  // Group FK rows by id, then build normalized strings
  const fkGroups = new Map<number, Array<(typeof table.foreignKeys)[number]>>();
  for (const fk of table.foreignKeys) {
    if (!fkGroups.has(fk.id)) fkGroups.set(fk.id, []);
    fkGroups.get(fk.id)!.push(fk);
  }

  const strs: Array<string> = [];
  for (const [, rows] of fkGroups) {
    const sorted = rows.sort((a, b) => a.seq - b.seq);
    const fromCols = sorted.map((r) => r.from).join(",");
    const toCols = sorted.map((r) => r.to).join(",");
    const targetTable = sorted[0].table;
    strs.push(`${fromCols}->${targetTable}(${toCols})`);
  }

  return strs.sort().join("|");
};

/**
 * Normalizes unique constraints from an existing table snapshot for comparison.
 * Unique constraints in SQLite appear as indexes with origin "u".
 */
const normalizeUniqueConstraints = (table: SqliteSnapshotTable): string => {
  const uniqueIndexes = table.indexes.filter((idx) => idx.origin === "u");
  const strs: Array<string> = [];

  for (const idx of uniqueIndexes) {
    const cols = idx.columns
      .sort((a, b) => a.seqno - b.seqno)
      .map((c) => c.name)
      .join(",");
    strs.push(`${idx.name}:${cols}`);
  }

  return strs.sort().join("|");
};

/**
 * Compares a `SqliteDesiredSchema` against a `SqliteDbSnapshot` and produces a
 * `SqliteSyncPlan` with the operations needed to bring the database in sync.
 *
 * Operations:
 * - `create_table`: table in desired but not in snapshot
 * - `add_column`: safe column additions (nullable or with default)
 * - `recreate_table`: column changes requiring the 12-step ALTER TABLE workaround
 * - `create_index`: index in desired but not in snapshot
 * - `drop_index`: ORM-managed index in snapshot but not in desired
 */
export const diffSchema = (
  snapshot: SqliteDbSnapshot,
  desired: SqliteDesiredSchema,
): SqliteSyncPlan => {
  const operations: Array<SqliteSyncOperation> = [];

  for (const desiredTable of desired.tables) {
    const existingTable = snapshot.tables.get(desiredTable.name);

    if (!existingTable) {
      // New table
      operations.push({
        type: "create_table",
        tableName: desiredTable.name,
        ddl: renderCreateTableDDL(desiredTable),
        foreignTableDeps: desiredTable.foreignKeys
          .map((fk) => fk.foreignTable)
          .filter((t) => t !== desiredTable.name),
      });

      // Indexes for new table
      for (const ddl of renderIndexDDL(desiredTable)) {
        operations.push({ type: "create_index", ddl });
      }

      continue;
    }

    // Existing table — check if we can use simple ADD COLUMN
    const addColumnCheck = canUseAddColumn(existingTable, desiredTable);

    if (addColumnCheck.safe && addColumnCheck.newColumns.length > 0) {
      // Safe to add columns via ALTER TABLE
      for (const col of addColumnCheck.newColumns) {
        let def = `${quoteIdentifier(col.name)} ${col.sqliteType}`;
        if (col.defaultExpr) def += ` DEFAULT ${col.defaultExpr}`;
        if (!col.nullable) def += " NOT NULL";
        if (col.checkExpr) def += ` ${col.checkExpr}`;

        operations.push({
          type: "add_column",
          tableName: desiredTable.name,
          ddl: `ALTER TABLE ${quoteIdentifier(desiredTable.name)} ADD COLUMN ${def};`,
        });
      }
    } else if (!addColumnCheck.safe) {
      // Need recreate-table if there are actual differences
      const hasDifferences = hasTableDifferences(existingTable, desiredTable);

      if (hasDifferences) {
        const existingColNames = new Set(existingTable.columns.map((c) => c.name));
        const desiredColNames = new Set(desiredTable.columns.map((c) => c.name));
        const copyColumns = Array.from(existingColNames).filter((name) =>
          desiredColNames.has(name),
        );

        const tempName = `_new_${desiredTable.name}`;
        const newDdl = renderCreateTableDDLForRecreate(tempName, desiredTable);
        const newIndexesDdl = renderIndexDDL(desiredTable);

        operations.push({
          type: "recreate_table",
          tableName: desiredTable.name,
          newDdl,
          copyColumns,
          newIndexesDdl,
        });
      }
    }

    // Diff indexes on existing table (only if not doing recreate — recreate handles indexes)
    const isRecreating = operations.some(
      (op) => op.type === "recreate_table" && op.tableName === desiredTable.name,
    );

    if (!isRecreating) {
      diffIndexes(existingTable, desiredTable, operations);
    }
  }

  return { operations };
};

/**
 * Checks if there are any structural differences between an existing table
 * and the desired table definition.
 */
const hasTableDifferences = (
  existing: SqliteSnapshotTable,
  desired: SqliteDesiredTable,
): boolean => {
  const existingColNames = new Set(existing.columns.map((c) => c.name));
  const desiredColNames = new Set(desired.columns.map((c) => c.name));

  // Column count difference
  if (existingColNames.size !== desiredColNames.size) return true;

  // Column set difference
  for (const name of existingColNames) {
    if (!desiredColNames.has(name)) return true;
  }
  for (const name of desiredColNames) {
    if (!existingColNames.has(name)) return true;
  }

  // Column definition changes
  for (const existingCol of existing.columns) {
    const desiredCol = desired.columns.find((c) => c.name === existingCol.name);
    if (!desiredCol) return true;

    if (normalizeType(existingCol.type) !== normalizeType(desiredCol.sqliteType))
      return true;
    if (existingCol.notNull !== !desiredCol.nullable) return true;
    if (
      normalizeDefault(existingCol.defaultValue) !==
      normalizeDefault(desiredCol.defaultExpr)
    )
      return true;
  }

  // PK changes
  const existingPks = existing.columns
    .filter((c) => c.pk > 0)
    .sort((a, b) => a.pk - b.pk)
    .map((c) => c.name);
  if (existingPks.join(",") !== desired.primaryKeys.join(",")) return true;

  // FK changes
  const existingFkStr = normalizeFks(existing);
  const desiredFkStr = desired.foreignKeys
    .map(
      (fk) =>
        `${fk.columns.join(",")}->${fk.foreignTable}(${fk.foreignColumns.join(",")})`,
    )
    .sort()
    .join("|");
  if (existingFkStr !== desiredFkStr) return true;

  // Unique constraint changes
  const existingUniqueStr = normalizeUniqueConstraints(existing);
  const desiredUniqueStr = desired.uniqueConstraints
    .map((u) => `${u.name}:${u.columns.join(",")}`)
    .sort()
    .join("|");
  if (existingUniqueStr !== desiredUniqueStr) return true;

  return false;
};

/**
 * Diffs indexes between existing and desired tables.
 * Only manages ORM-created indexes (origin "c" from PRAGMA index_list).
 */
const diffIndexes = (
  existing: SqliteSnapshotTable,
  desired: SqliteDesiredTable,
  operations: Array<SqliteSyncOperation>,
): void => {
  const desiredIndexMap = new Map(desired.indexes.map((idx) => [idx.name, idx]));
  const existingIndexMap = new Map(
    existing.indexes.filter((idx) => idx.origin === "c").map((idx) => [idx.name, idx]),
  );

  // Drop indexes that exist but are not desired, or whose definition has changed
  for (const [name, existingIdx] of existingIndexMap) {
    const desiredIdx = desiredIndexMap.get(name);

    if (!desiredIdx) {
      // Index removed entirely
      operations.push({ type: "drop_index", indexName: name });
    } else if (hasIndexDefinitionChanged(existingIdx, desiredIdx)) {
      // Definition changed — drop and recreate
      operations.push({ type: "drop_index", indexName: name });
    }
  }

  // Create indexes that are desired but don't exist, or whose definition has changed
  for (const [name, desiredIdx] of desiredIndexMap) {
    const existingIdx = existingIndexMap.get(name);

    if (!existingIdx || hasIndexDefinitionChanged(existingIdx, desiredIdx)) {
      const unique = desiredIdx.unique ? "UNIQUE " : "";
      const cols = desiredIdx.columns
        .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
        .join(", ");

      let stmt = `CREATE ${unique}INDEX IF NOT EXISTS ${quoteIdentifier(desiredIdx.name)} ON ${quoteIdentifier(desired.name)} (${cols})`;
      if (desiredIdx.where) stmt += ` WHERE ${desiredIdx.where}`;

      operations.push({
        type: "create_index",
        ddl: stmt + ";",
      });
    }
  }
};

/**
 * Checks if an existing index definition differs from the desired definition.
 * Compares columns (ordered), uniqueness, and partial index (WHERE clause).
 */
const hasIndexDefinitionChanged = (
  existing: SqliteSnapshotIndex,
  desired: SqliteDesiredIndex,
): boolean => {
  // Unique flag
  if (existing.unique !== desired.unique) return true;

  // Partial index flag (existing has boolean `partial`, desired has `where` string or null)
  if (existing.partial !== (desired.where !== null)) return true;

  // Column count
  if (existing.columns.length !== desired.columns.length) return true;

  // Column names in order
  const existingCols = existing.columns
    .sort((a, b) => a.seqno - b.seqno)
    .map((c) => c.name);
  const desiredCols = desired.columns.map((c) => c.name);

  for (let i = 0; i < existingCols.length; i++) {
    if (existingCols[i] !== desiredCols[i]) return true;
  }

  return false;
};
