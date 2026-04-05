import type {
  MysqlDbSnapshot,
  MysqlSnapshotColumn,
  MysqlSnapshotTable,
} from "../../types/db-snapshot";
import type { MysqlSyncOperation } from "../../types/sync-plan";
import { quoteIdentifier } from "../quote-identifier";

const findTable = (
  snapshot: MysqlDbSnapshot,
  tableName: string,
): MysqlSnapshotTable | null => snapshot.tables.get(tableName) ?? null;

const reconstructColumnDef = (col: MysqlSnapshotColumn): string => {
  const parts: Array<string> = [quoteIdentifier(col.name)];
  parts.push(col.columnType.toUpperCase());

  if (col.extra.includes("stored generated") || col.extra.includes("virtual generated")) {
    // Computed columns cannot be reliably reconstructed from snapshot alone
    return parts.join(" ");
  }

  if (col.extra.includes("auto_increment")) {
    parts.push("AUTO_INCREMENT");
  } else {
    if (!col.nullable) {
      parts.push("NOT NULL");
    }
    if (col.defaultValue != null) {
      parts.push(`DEFAULT ${col.defaultValue}`);
    }
  }

  return parts.join(" ");
};

/**
 * Generates down-migration SQL for a MySQL sync operation by reversing it.
 * Returns `null` for irreversible operations (emitted as WARN comments in migration file).
 */
export const generateMysqlDownSql = (
  op: MysqlSyncOperation,
  snapshot: MysqlDbSnapshot,
): string | null => {
  switch (op.type) {
    case "create_table":
      return `DROP TABLE IF EXISTS ${quoteIdentifier(op.tableName)};`;

    case "add_column": {
      // Extract column name from SQL: ALTER TABLE `t` ADD COLUMN `col` ...
      const match = op.sql.match(/ADD\s+COLUMN\s+`([^`]+)`/i);
      if (!match) return null;
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} DROP COLUMN ${quoteIdentifier(match[1])};`;
    }

    case "modify_column": {
      // Reconstruct previous column definition from snapshot
      const table = findTable(snapshot, op.tableName);
      if (!table) return null;
      const col = table.columns.find(
        (c) => c.name.toLowerCase() === op.columnName.toLowerCase(),
      );
      if (!col) return null;
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} MODIFY COLUMN ${reconstructColumnDef(col)};`;
    }

    case "drop_column":
      // Irreversible: data and column definition are lost
      return null;

    case "add_index":
      return `DROP INDEX ${quoteIdentifier(op.indexName)} ON ${quoteIdentifier(op.tableName)};`;

    case "drop_index": {
      const table = findTable(snapshot, op.tableName);
      if (!table) return null;
      const idx = table.indexes.find((i) => i.name === op.indexName);
      if (!idx) return null;
      const cols = idx.columns
        .sort((a, b) => a.seq - b.seq)
        .map((c) => `${quoteIdentifier(c.name)} ${c.direction.toUpperCase()}`)
        .join(", ");
      const unique = idx.unique ? "UNIQUE " : "";
      return `CREATE ${unique}INDEX ${quoteIdentifier(op.indexName)} ON ${quoteIdentifier(op.tableName)} (${cols});`;
    }

    case "add_fk":
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} DROP FOREIGN KEY ${quoteIdentifier(op.constraintName)};`;

    case "drop_fk": {
      const table = findTable(snapshot, op.tableName);
      if (!table) return null;
      const fk = table.foreignKeys.find((f) => f.constraintName === op.constraintName);
      if (!fk) return null;
      const cols = fk.columns.map((c) => quoteIdentifier(c)).join(", ");
      const refCols = fk.referencedColumns.map((c) => quoteIdentifier(c)).join(", ");
      const onDelete = fk.deleteRule !== "NO ACTION" ? ` ON DELETE ${fk.deleteRule}` : "";
      const onUpdate = fk.updateRule !== "NO ACTION" ? ` ON UPDATE ${fk.updateRule}` : "";
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} ADD CONSTRAINT ${quoteIdentifier(op.constraintName)} FOREIGN KEY (${cols}) REFERENCES ${quoteIdentifier(fk.referencedTable)} (${refCols})${onDelete}${onUpdate};`;
    }

    case "add_check":
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} DROP CHECK ${quoteIdentifier(op.constraintName)};`;

    case "add_unique":
      // MySQL unique constraints are indexes — drop via DROP INDEX
      return `ALTER TABLE ${quoteIdentifier(op.tableName)} DROP INDEX ${quoteIdentifier(op.constraintName)};`;

    case "drop_constraint":
      // Irreversible: would need to reconstruct constraint from snapshot
      return null;

    case "create_trigger":
      // Reverse a CREATE TRIGGER by dropping it
      if (op.sql.includes("CREATE TRIGGER")) {
        return `DROP TRIGGER IF EXISTS ${quoteIdentifier(op.triggerName)};`;
      }
      // DROP IF EXISTS is a setup step — irreversible
      return null;

    case "drop_trigger":
      // Irreversible: we don't store the original CREATE TRIGGER DDL
      return null;

    default:
      return null;
  }
};
