import {
  formatTimestamp,
  kebabToPascal,
  sanitizeName,
} from "#internal/cli/utils/migration-naming";
import { ShaKit } from "@lindorm/sha";
import { randomUUID } from "crypto";
import type { MysqlDbSnapshot } from "../../types/db-snapshot";
import type { MysqlSyncOperation, MysqlSyncPlan } from "../../types/sync-plan";
import { generateMysqlDownSql } from "./generate-down-sql";

export type SerializedMysqlMigration = {
  filename: string;
  content: string;
  checksum: string;
  id: string;
  ts: string;
};

export type SerializeMysqlMigrationOptions = {
  name?: string;
  timestamp?: Date;
};

// Collapse all whitespace to single spaces for checksum stability
const normalizeSql = (sql: string): string => sql.replace(/\s+/g, " ").trim();

const escapeBacktick = (sql: string): string =>
  sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const indent = (line: string, level: number): string =>
  line ? " ".repeat(level) + line : "";

const describeOp = (op: MysqlSyncOperation): string => {
  switch (op.type) {
    case "create_table":
      return `Create table "${op.tableName}"`;
    case "add_column":
      return `Add column on "${op.tableName}"`;
    case "modify_column":
      return `Modify column "${op.columnName}" on "${op.tableName}"`;
    case "drop_column":
      return `Drop column "${op.columnName}" on "${op.tableName}"`;
    case "add_index":
      return `Add index "${op.indexName}" on "${op.tableName}"`;
    case "drop_index":
      return `Drop index "${op.indexName}" on "${op.tableName}"`;
    case "add_fk":
      return `Add FK "${op.constraintName}" on "${op.tableName}"`;
    case "drop_fk":
      return `Drop FK "${op.constraintName}" on "${op.tableName}"`;
    case "add_check":
      return `Add check "${op.constraintName}" on "${op.tableName}"`;
    case "add_unique":
      return `Add unique "${op.constraintName}" on "${op.tableName}"`;
    case "drop_constraint":
      return `Drop constraint "${op.constraintName}" on "${op.tableName}"`;
    case "create_trigger":
      return `Create trigger "${op.triggerName}" on "${op.tableName}"`;
    case "drop_trigger":
      return `Drop trigger "${op.triggerName}" on "${op.tableName}"`;
  }
};

const buildUpBody = (ops: Array<MysqlSyncOperation>): Array<string> => {
  const lines: Array<string> = [];

  for (const op of ops) {
    lines.push(`// ${describeOp(op)}`);
    lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.sql))}\`);`);
  }

  return lines;
};

type DownEntry = {
  sql: string | null;
  description: string;
};

const buildDownBody = (entries: Array<DownEntry>): Array<string> => {
  const lines: Array<string> = [];

  for (const entry of entries) {
    if (entry.sql) {
      lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(entry.sql))}\`);`);
    } else {
      lines.push(`// WARN: irreversible — ${entry.description}`);
    }
  }

  return lines;
};

export const serializeMysqlMigration = (
  plan: MysqlSyncPlan,
  snapshot: MysqlDbSnapshot,
  options: SerializeMysqlMigrationOptions = {},
): SerializedMysqlMigration => {
  const now = options.timestamp ?? new Date();
  const id = randomUUID();
  const ts = now.toISOString();
  const stamp = formatTimestamp(now);

  const nameSlug = options.name ? sanitizeName(options.name) : "generated";
  const className = options.name ? kebabToPascal(nameSlug) : `Generated${stamp}`;
  const filename = `${stamp}-${nameSlug}.ts`;

  const ops = plan.operations;

  // Generate down entries (reversed for undo ordering)
  const downEntries: Array<DownEntry> = ops.map((op) => ({
    sql: generateMysqlDownSql(op, snapshot),
    description: describeOp(op),
  }));
  const reversed = [...downEntries].reverse();

  // Compute checksum from normalized SQL
  const upSqlStrings = ops.map((op) => normalizeSql(op.sql));
  const downSqlStrings = reversed.map((e) => (e.sql ? normalizeSql(e.sql) : ""));
  const canonical = upSqlStrings.join("\n") + "\n---\n" + downSqlStrings.join("\n");
  const checksum = ShaKit.S256(canonical);

  // Build method bodies
  const upBody = buildUpBody(ops);
  const downBody = buildDownBody(reversed);

  // Assemble file content
  const lines: Array<string> = [
    `import type { MigrationInterface, SqlMigrationRunner } from "@lindorm/proteus";`,
    ``,
    `export class ${className} implements MigrationInterface {`,
    `  public readonly id = "${id}";`,
    `  public readonly ts = "${ts}";`,
    `  public readonly driver = "mysql";`,
    ``,
    `  public async up(runner: SqlMigrationRunner): Promise<void> {`,
    ...upBody.map((line) => indent(line, 4)),
    `  }`,
    ``,
    `  public async down(runner: SqlMigrationRunner): Promise<void> {`,
    ...downBody.map((line) => indent(line, 4)),
    `  }`,
    `}`,
    ``,
  ];

  const content = lines.join("\n");

  return { filename, content, checksum, id, ts };
};
