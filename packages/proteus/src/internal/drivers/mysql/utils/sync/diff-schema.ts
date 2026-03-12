import type {
  MysqlDesiredSchema,
  MysqlDesiredTable,
  MysqlDesiredColumn,
  MysqlDesiredIndex,
  MysqlDesiredForeignKey,
  MysqlDesiredCheck,
  MysqlDesiredUnique,
} from "../../types/desired-schema";
import type {
  MysqlDbSnapshot,
  MysqlSnapshotTable,
  MysqlSnapshotIndex,
  MysqlSnapshotForeignKey,
  MysqlSnapshotUnique,
} from "../../types/db-snapshot";
import type { MysqlSyncOperation, MysqlSyncPlan } from "../../types/sync-plan";
import { quoteIdentifier } from "../quote-identifier";
import { MySqlSyncError } from "../../errors/MySqlSyncError";

const renderUniqueColumns = (uq: MysqlDesiredUnique): string =>
  uq.columns
    .map((c) => {
      const q = quoteIdentifier(c.name);
      return c.prefixLength != null ? `${q}(${c.prefixLength})` : q;
    })
    .join(", ");

// ---------------------------------------------------------------------------
// Render helpers
// ---------------------------------------------------------------------------

const renderColumnDef = (col: MysqlDesiredColumn): string => {
  const parts: Array<string> = [quoteIdentifier(col.name)];

  if (col.enumValues) {
    const escaped = col.enumValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
    parts.push(`ENUM(${escaped})`);
  } else {
    parts.push(col.mysqlType.toUpperCase());
  }

  if (col.computed) {
    parts.push(`GENERATED ALWAYS AS (${col.computed}) STORED`);
    if (!col.nullable) parts.push("NOT NULL");
  } else if (col.isAutoIncrement) {
    parts.push("AUTO_INCREMENT");
  } else {
    if (col.defaultExpr != null) parts.push(`DEFAULT ${col.defaultExpr}`);
    if (!col.nullable) parts.push("NOT NULL");
  }

  return parts.join(" ");
};

const renderCreateTableDDL = (table: MysqlDesiredTable): string => {
  const lines: Array<string> = [];

  for (const col of table.columns) {
    lines.push(renderColumnDef(col));
  }

  // Primary key
  const pkCols = table.primaryKeys.map(quoteIdentifier).join(", ");
  lines.push(`PRIMARY KEY (${pkCols})`);

  // FK constraints
  for (const fk of table.foreignKeys) {
    const cols = fk.columns.map(quoteIdentifier).join(", ");
    const refCols = fk.foreignColumns.map(quoteIdentifier).join(", ");
    lines.push(
      `CONSTRAINT ${quoteIdentifier(fk.constraintName)} FOREIGN KEY (${cols})` +
        ` REFERENCES ${quoteIdentifier(fk.foreignTable)} (${refCols})` +
        ` ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate}`,
    );
  }

  // Check constraints
  for (const chk of table.checkConstraints) {
    lines.push(`CONSTRAINT ${quoteIdentifier(chk.name)} CHECK (${chk.expression})`);
  }

  // Unique constraints
  for (const uq of table.uniqueConstraints) {
    const cols = uq.columns
      .map((c) => {
        const q = quoteIdentifier(c.name);
        return c.prefixLength != null ? `${q}(${c.prefixLength})` : q;
      })
      .join(", ");
    lines.push(`UNIQUE KEY ${quoteIdentifier(uq.name)} (${cols})`);
  }

  const body = lines.map((l) => `  ${l}`).join(",\n");
  return (
    `CREATE TABLE IF NOT EXISTS ${quoteIdentifier(table.name)} (\n${body}\n)` +
    ` ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;`
  );
};

const renderIndexDDL = (
  table: MysqlDesiredTable,
): Array<{ name: string; sql: string }> => {
  const results: Array<{ name: string; sql: string }> = [];

  for (const idx of table.indexes) {
    const unique = idx.unique ? "UNIQUE " : "";
    const cols = idx.columns
      .map((c) => {
        let col = quoteIdentifier(c.name);
        if (c.prefixLength != null) col += `(${c.prefixLength})`;
        col += ` ${c.direction.toUpperCase()}`;
        return col;
      })
      .join(", ");

    const sql = `CREATE ${unique}INDEX ${quoteIdentifier(idx.name)} ON ${quoteIdentifier(table.name)} (${cols});`;
    results.push({ name: idx.name, sql });
  }

  return results;
};

// ---------------------------------------------------------------------------
// Column comparison
// ---------------------------------------------------------------------------

const normalizeType = (t: string): string => t.toLowerCase().trim();

const normalizeDefault = (expr: string | null | undefined): string => {
  if (expr === null || expr === undefined) return "";
  return expr.trim();
};

/**
 * Compares a desired column against a snapshot column to determine if MODIFY COLUMN is needed.
 */
const hasColumnChanged = (
  desired: MysqlDesiredColumn,
  snapshot: {
    columnType: string;
    nullable: boolean;
    defaultValue: string | null;
    extra: string;
  },
): boolean => {
  // Type comparison — compare full column types
  let desiredType: string;
  if (desired.enumValues) {
    const escaped = desired.enumValues.map((v) => `'${v.replace(/'/g, "''")}'`).join(",");
    desiredType = `enum(${escaped})`;
  } else {
    desiredType = desired.mysqlType;
  }

  if (normalizeType(desiredType) !== normalizeType(snapshot.columnType)) return true;

  // Nullability
  if (desired.nullable !== snapshot.nullable) return true;

  // Auto-increment
  const snapshotAutoInc = snapshot.extra.includes("auto_increment");
  if (desired.isAutoIncrement !== snapshotAutoInc) return true;

  // Default value
  if (!desired.isAutoIncrement) {
    if (normalizeDefault(desired.defaultExpr) !== normalizeDefault(snapshot.defaultValue))
      return true;
  }

  return false;
};

// ---------------------------------------------------------------------------
// FK comparison
// ---------------------------------------------------------------------------

const fkSignature = (
  cols: Array<string>,
  foreignTable: string,
  foreignCols: Array<string>,
  onDelete: string,
  onUpdate: string,
): string =>
  `${cols.join(",")}->${foreignTable}(${foreignCols.join(",")})::${onDelete}::${onUpdate}`.toLowerCase();

// ---------------------------------------------------------------------------
// Index comparison
// ---------------------------------------------------------------------------

const indexSignature = (idx: MysqlDesiredIndex): string => {
  const cols = idx.columns
    .map((c) => `${c.name}:${c.direction}:${c.prefixLength ?? 0}`)
    .join(",");
  return `${idx.unique ? "u" : ""}:${cols}`;
};

const snapshotIndexSignature = (idx: MysqlSnapshotIndex): string => {
  const cols = idx.columns
    .sort((a, b) => a.seq - b.seq)
    .map((c) => `${c.name}:${c.direction}:${c.subPart ?? 0}`)
    .join(",");
  return `${idx.unique ? "u" : ""}:${cols}`;
};

// ---------------------------------------------------------------------------
// Main diff
// ---------------------------------------------------------------------------

/**
 * Compares a `MysqlDesiredSchema` against a `MysqlDbSnapshot` and produces a
 * `MysqlSyncPlan` with the operations needed to bring the database in sync.
 *
 * MySQL supports ALTER TABLE for column/constraint changes (unlike SQLite recreate-table).
 * DDL is auto-committed and not transactional.
 */
export const diffSchema = (
  snapshot: MysqlDbSnapshot,
  desired: MysqlDesiredSchema,
): MysqlSyncPlan => {
  const operations: Array<MysqlSyncOperation> = [];

  for (const desiredTable of desired.tables) {
    const existingTable = snapshot.tables.get(desiredTable.name);

    if (!existingTable) {
      // New table — full CREATE TABLE
      operations.push({
        type: "create_table",
        tableName: desiredTable.name,
        sql: renderCreateTableDDL(desiredTable),
        foreignTableDeps: desiredTable.foreignKeys
          .map((fk) => fk.foreignTable)
          .filter((t) => t !== desiredTable.name),
      });

      // Indexes for new table
      for (const { name, sql } of renderIndexDDL(desiredTable)) {
        operations.push({
          type: "add_index",
          tableName: desiredTable.name,
          indexName: name,
          sql,
        });
      }

      continue;
    }

    // Existing table — diff columns, FKs, indexes, constraints
    diffColumns(existingTable, desiredTable, operations);
    diffForeignKeys(existingTable, desiredTable, operations);
    diffUniqueConstraints(existingTable, desiredTable, operations);
    diffCheckConstraints(existingTable, desiredTable, operations);
    diffIndexes(existingTable, desiredTable, operations);
  }

  // Topologically sort create_table operations
  return { operations: topologicallySortCreateTables(operations) };
};

// ---------------------------------------------------------------------------
// Column diff
// ---------------------------------------------------------------------------

const diffColumns = (
  existing: MysqlSnapshotTable,
  desired: MysqlDesiredTable,
  operations: Array<MysqlSyncOperation>,
): void => {
  const existingColMap = new Map(existing.columns.map((c) => [c.name.toLowerCase(), c]));
  const desiredColMap = new Map(desired.columns.map((c) => [c.name.toLowerCase(), c]));
  const qt = quoteIdentifier(desired.name);

  // New columns
  for (const [key, col] of desiredColMap) {
    if (!existingColMap.has(key)) {
      operations.push({
        type: "add_column",
        tableName: desired.name,
        sql: `ALTER TABLE ${qt} ADD COLUMN ${renderColumnDef(col)};`,
      });
    }
  }

  // Modified columns
  for (const [key, col] of desiredColMap) {
    const snap = existingColMap.get(key);
    if (!snap) continue;

    if (hasColumnChanged(col, snap)) {
      operations.push({
        type: "modify_column",
        tableName: desired.name,
        columnName: col.name,
        sql: `ALTER TABLE ${qt} MODIFY COLUMN ${renderColumnDef(col)};`,
      });
    }
  }

  // Dropped columns — columns in DB but not in desired schema
  const pkSet = new Set(desired.primaryKeys.map((k) => k.toLowerCase()));
  for (const [key, snap] of existingColMap) {
    if (desiredColMap.has(key)) continue;
    // Never drop PK columns
    if (pkSet.has(key)) continue;

    operations.push({
      type: "drop_column",
      tableName: desired.name,
      columnName: snap.name,
      sql: `ALTER TABLE ${qt} DROP COLUMN ${quoteIdentifier(snap.name)};`,
    });
  }
};

// ---------------------------------------------------------------------------
// FK diff
// ---------------------------------------------------------------------------

const diffForeignKeys = (
  existing: MysqlSnapshotTable,
  desired: MysqlDesiredTable,
  operations: Array<MysqlSyncOperation>,
): void => {
  const qt = quoteIdentifier(desired.name);

  // Build signature maps
  const existingFkByName = new Map<string, MysqlSnapshotForeignKey>();
  for (const fk of existing.foreignKeys) {
    existingFkByName.set(fk.constraintName.toLowerCase(), fk);
  }

  const desiredFkByName = new Map<string, MysqlDesiredForeignKey>();
  for (const fk of desired.foreignKeys) {
    desiredFkByName.set(fk.constraintName.toLowerCase(), fk);
  }

  // Drop FKs that are no longer desired
  for (const [name] of existingFkByName) {
    if (!desiredFkByName.has(name)) {
      operations.push({
        type: "drop_fk",
        tableName: desired.name,
        constraintName: name,
        sql: `ALTER TABLE ${qt} DROP FOREIGN KEY ${quoteIdentifier(name)};`,
      });
    }
  }

  // Add FKs that don't exist
  for (const [name, fk] of desiredFkByName) {
    const existingFk = existingFkByName.get(name);
    if (!existingFk) {
      const cols = fk.columns.map(quoteIdentifier).join(", ");
      const refCols = fk.foreignColumns.map(quoteIdentifier).join(", ");
      operations.push({
        type: "add_fk",
        tableName: desired.name,
        constraintName: fk.constraintName,
        sql: `ALTER TABLE ${qt} ADD CONSTRAINT ${quoteIdentifier(fk.constraintName)} FOREIGN KEY (${cols}) REFERENCES ${quoteIdentifier(fk.foreignTable)} (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`,
      });
    } else {
      // Check if FK definition changed — drop and re-add
      const existingSig = fkSignature(
        existingFk.columns,
        existingFk.referencedTable,
        existingFk.referencedColumns,
        existingFk.deleteRule,
        existingFk.updateRule,
      );
      const desiredSig = fkSignature(
        fk.columns,
        fk.foreignTable,
        fk.foreignColumns,
        fk.onDelete,
        fk.onUpdate,
      );

      if (existingSig !== desiredSig) {
        operations.push({
          type: "drop_fk",
          tableName: desired.name,
          constraintName: name,
          sql: `ALTER TABLE ${qt} DROP FOREIGN KEY ${quoteIdentifier(name)};`,
        });

        const cols = fk.columns.map(quoteIdentifier).join(", ");
        const refCols = fk.foreignColumns.map(quoteIdentifier).join(", ");
        operations.push({
          type: "add_fk",
          tableName: desired.name,
          constraintName: fk.constraintName,
          sql: `ALTER TABLE ${qt} ADD CONSTRAINT ${quoteIdentifier(fk.constraintName)} FOREIGN KEY (${cols}) REFERENCES ${quoteIdentifier(fk.foreignTable)} (${refCols}) ON DELETE ${fk.onDelete} ON UPDATE ${fk.onUpdate};`,
        });
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Unique constraint diff
// ---------------------------------------------------------------------------

const diffUniqueConstraints = (
  existing: MysqlSnapshotTable,
  desired: MysqlDesiredTable,
  operations: Array<MysqlSyncOperation>,
): void => {
  const qt = quoteIdentifier(desired.name);

  const existingUqByName = new Map<string, MysqlSnapshotUnique>();
  for (const uq of existing.uniqueConstraints) {
    existingUqByName.set(uq.constraintName.toLowerCase(), uq);
  }

  const desiredUqByName = new Map<string, MysqlDesiredUnique>();
  for (const uq of desired.uniqueConstraints) {
    desiredUqByName.set(uq.name.toLowerCase(), uq);
  }

  // Drop unique constraints that are no longer desired
  for (const [name] of existingUqByName) {
    if (!desiredUqByName.has(name)) {
      // In MySQL, unique constraints are indexes — use DROP INDEX
      operations.push({
        type: "drop_constraint",
        tableName: desired.name,
        constraintName: name,
        sql: `ALTER TABLE ${qt} DROP INDEX ${quoteIdentifier(name)};`,
      });
    }
  }

  // Add or recreate unique constraints
  for (const [name, uq] of desiredUqByName) {
    const existingUq = existingUqByName.get(name);

    if (!existingUq) {
      // New unique constraint
      const cols = renderUniqueColumns(uq);
      operations.push({
        type: "add_unique",
        tableName: desired.name,
        constraintName: uq.name,
        sql: `ALTER TABLE ${qt} ADD UNIQUE KEY ${quoteIdentifier(uq.name)} (${cols});`,
      });
    } else {
      // Check if column composition or prefix lengths changed
      const existingCols = existingUq.columns
        .sort((a, b) => a.ordinalPosition - b.ordinalPosition)
        .map((c) => `${c.name.toLowerCase()}:${c.subPart ?? 0}`)
        .join(",");
      const desiredCols = uq.columns
        .map((c) => `${c.name.toLowerCase()}:${c.prefixLength ?? 0}`)
        .join(",");

      if (existingCols !== desiredCols) {
        // Drop old, create new
        operations.push({
          type: "drop_constraint",
          tableName: desired.name,
          constraintName: name,
          sql: `ALTER TABLE ${qt} DROP INDEX ${quoteIdentifier(name)};`,
        });

        const cols = renderUniqueColumns(uq);
        operations.push({
          type: "add_unique",
          tableName: desired.name,
          constraintName: uq.name,
          sql: `ALTER TABLE ${qt} ADD UNIQUE KEY ${quoteIdentifier(uq.name)} (${cols});`,
        });
      }
    }
  }
};

// ---------------------------------------------------------------------------
// Check constraint diff
// ---------------------------------------------------------------------------

const normalizeCheckExpr = (expr: string): string =>
  expr
    .replace(/^[(`\s]+|[)`\s]+$/g, "")
    .replace(/`/g, "")
    .toLowerCase()
    .trim();

const diffCheckConstraints = (
  existing: MysqlSnapshotTable,
  desired: MysqlDesiredTable,
  operations: Array<MysqlSyncOperation>,
): void => {
  const qt = quoteIdentifier(desired.name);

  const existingChkByName = new Map<string, string>();
  for (const chk of existing.checkConstraints) {
    existingChkByName.set(chk.constraintName.toLowerCase(), chk.checkClause);
  }

  const desiredChkByName = new Map<string, MysqlDesiredCheck>();
  for (const chk of desired.checkConstraints) {
    desiredChkByName.set(chk.name.toLowerCase(), chk);
  }

  // Drop check constraints that are no longer desired
  for (const [name] of existingChkByName) {
    if (!desiredChkByName.has(name)) {
      operations.push({
        type: "drop_constraint",
        tableName: desired.name,
        constraintName: name,
        sql: `ALTER TABLE ${qt} DROP CHECK ${quoteIdentifier(name)};`,
      });
    }
  }

  // Add or recreate check constraints
  for (const [name, chk] of desiredChkByName) {
    const existingExpr = existingChkByName.get(name);

    if (existingExpr === undefined) {
      // New check constraint
      operations.push({
        type: "add_check",
        tableName: desired.name,
        constraintName: chk.name,
        sql: `ALTER TABLE ${qt} ADD CONSTRAINT ${quoteIdentifier(chk.name)} CHECK (${chk.expression});`,
      });
    } else if (normalizeCheckExpr(existingExpr) !== normalizeCheckExpr(chk.expression)) {
      // Expression changed — drop and re-add
      operations.push({
        type: "drop_constraint",
        tableName: desired.name,
        constraintName: name,
        sql: `ALTER TABLE ${qt} DROP CHECK ${quoteIdentifier(name)};`,
      });
      operations.push({
        type: "add_check",
        tableName: desired.name,
        constraintName: chk.name,
        sql: `ALTER TABLE ${qt} ADD CONSTRAINT ${quoteIdentifier(chk.name)} CHECK (${chk.expression});`,
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Index diff
// ---------------------------------------------------------------------------

const diffIndexes = (
  existing: MysqlSnapshotTable,
  desired: MysqlDesiredTable,
  operations: Array<MysqlSyncOperation>,
): void => {
  const qt = quoteIdentifier(desired.name);

  const desiredIndexMap = new Map(
    desired.indexes.map((idx) => [idx.name.toLowerCase(), idx]),
  );
  const existingIndexMap = new Map(
    existing.indexes.map((idx) => [idx.name.toLowerCase(), idx]),
  );

  // Drop indexes that exist but are not desired, or whose definition has changed
  for (const [name, existingIdx] of existingIndexMap) {
    const desiredIdx = desiredIndexMap.get(name);

    if (!desiredIdx) {
      operations.push({
        type: "drop_index",
        tableName: desired.name,
        indexName: name,
        sql: `ALTER TABLE ${qt} DROP INDEX ${quoteIdentifier(name)};`,
      });
    } else if (indexSignature(desiredIdx) !== snapshotIndexSignature(existingIdx)) {
      // Definition changed — drop and recreate
      operations.push({
        type: "drop_index",
        tableName: desired.name,
        indexName: name,
        sql: `ALTER TABLE ${qt} DROP INDEX ${quoteIdentifier(name)};`,
      });
    }
  }

  // Create indexes that are desired but don't exist, or whose definition has changed
  for (const [name, desiredIdx] of desiredIndexMap) {
    const existingIdx = existingIndexMap.get(name);

    if (
      !existingIdx ||
      indexSignature(desiredIdx) !== snapshotIndexSignature(existingIdx)
    ) {
      const unique = desiredIdx.unique ? "UNIQUE " : "";
      const cols = desiredIdx.columns
        .map((c) => {
          let col = quoteIdentifier(c.name);
          if (c.prefixLength != null) col += `(${c.prefixLength})`;
          col += ` ${c.direction.toUpperCase()}`;
          return col;
        })
        .join(", ");

      operations.push({
        type: "add_index",
        tableName: desired.name,
        indexName: desiredIdx.name,
        sql: `CREATE ${unique}INDEX ${quoteIdentifier(desiredIdx.name)} ON ${qt} (${cols});`,
      });
    }
  }
};

// ---------------------------------------------------------------------------
// Topological sort
// ---------------------------------------------------------------------------

/**
 * Topologically sorts create_table operations by FK dependency order (Kahn's algorithm).
 * Non-create_table operations retain their relative order after all create_table ops.
 */
const topologicallySortCreateTables = (
  ops: Array<MysqlSyncOperation>,
): Array<MysqlSyncOperation> => {
  const createOps: Array<Extract<MysqlSyncOperation, { type: "create_table" }>> = [];
  const otherOps: Array<{ op: MysqlSyncOperation; originalIndex: number }> = [];

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (op.type === "create_table") {
      createOps.push(op);
    } else {
      otherOps.push({ op, originalIndex: i });
    }
  }

  if (createOps.length <= 1) return ops;

  const creatingSet = new Set(createOps.map((op) => op.tableName));

  const inDegree = new Map<string, number>();
  const dependents = new Map<string, Array<string>>();

  for (const op of createOps) {
    inDegree.set(op.tableName, 0);
    dependents.set(op.tableName, []);
  }

  for (const op of createOps) {
    for (const dep of op.foreignTableDeps) {
      if (!creatingSet.has(dep)) continue;
      inDegree.set(op.tableName, (inDegree.get(op.tableName) ?? 0) + 1);
      dependents.get(dep)!.push(op.tableName);
    }
  }

  const queue: Array<string> = [];
  for (const [name, degree] of inDegree) {
    if (degree === 0) queue.push(name);
  }

  const sorted: Array<string> = [];
  while (queue.length > 0) {
    const current = queue.shift()!;
    sorted.push(current);

    for (const dependent of dependents.get(current) ?? []) {
      const newDegree = (inDegree.get(dependent) ?? 1) - 1;
      inDegree.set(dependent, newDegree);
      if (newDegree === 0) queue.push(dependent);
    }
  }

  if (sorted.length !== createOps.length) {
    const unsorted = createOps
      .filter((op) => !sorted.includes(op.tableName))
      .map((op) => op.tableName);
    throw new MySqlSyncError(
      `Circular foreign key dependency detected among tables: ${unsorted.join(", ")}. Cannot determine creation order.`,
    );
  }

  const createOpMap = new Map(createOps.map((op) => [op.tableName, op]));
  const result: Array<MysqlSyncOperation> = [];

  for (const name of sorted) {
    result.push(createOpMap.get(name)!);
  }

  for (const { op } of otherOps.sort((a, b) => a.originalIndex - b.originalIndex)) {
    result.push(op);
  }

  return result;
};
