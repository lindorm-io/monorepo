import {
  formatTimestamp,
  kebabToPascal,
  sanitizeName,
} from "../../../../cli/utils/migration-naming.js";
import { ShaKit } from "@lindorm/sha";
import { randomUUID } from "crypto";
import type { SqliteDbSnapshot } from "../../types/db-snapshot.js";
import type { SqliteSyncOperation, SqliteSyncPlan } from "../../types/sync-plan.js";

export type SerializedSqliteMigration = {
  filename: string;
  content: string;
  checksum: string;
  id: string;
  ts: string;
};

export type SerializeSqliteMigrationOptions = {
  name?: string;
  timestamp?: Date;
};

// Collapse all whitespace to single spaces for checksum stability.
const normalizeSql = (sql: string): string => sql.replace(/\s+/g, " ").trim();

const escapeBacktick = (sql: string): string =>
  sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const indent = (line: string, level: number): string =>
  line ? " ".repeat(level) + line : "";

// Extract index name from a CREATE INDEX DDL statement.
// Matches: CREATE [UNIQUE] INDEX [IF NOT EXISTS] "indexName" ON ...
const extractIndexName = (ddl: string): string | null => {
  const match = ddl.match(
    /CREATE\s+(?:UNIQUE\s+)?INDEX\s+(?:IF\s+NOT\s+EXISTS\s+)?"([^"]+)"/i,
  );
  return match ? match[1] : null;
};

// Extract the temp table name from newDdl — the first quoted identifier after CREATE TABLE
const extractTempTableName = (ddl: string): string | null => {
  const match = ddl.match(/CREATE\s+TABLE\s+"([^"]+)"/i);
  return match ? match[1] : null;
};

const buildUpSqlStrings = (ops: Array<SqliteSyncOperation>): Array<string> => {
  const sqls: Array<string> = [];

  for (const op of ops) {
    switch (op.type) {
      case "create_table":
        sqls.push(op.ddl);
        break;
      case "add_column":
        sqls.push(op.ddl);
        break;
      case "create_index":
        sqls.push(op.ddl);
        break;
      case "drop_index":
        sqls.push(`DROP INDEX IF EXISTS "${op.indexName}";`);
        break;
      case "drop_table":
        sqls.push(`DROP TABLE IF EXISTS "${op.tableName}";`);
        break;
      case "recreate_table": {
        const tempName = extractTempTableName(op.newDdl) ?? `_new_${op.tableName}`;
        sqls.push(`PRAGMA foreign_keys = OFF`);
        sqls.push(op.newDdl);
        sqls.push(
          `INSERT INTO "${tempName}" SELECT ${op.copyColumns.map((c) => `"${c}"`).join(", ")} FROM "${op.tableName}"`,
        );
        sqls.push(`DROP TABLE "${op.tableName}"`);
        sqls.push(`ALTER TABLE "${tempName}" RENAME TO "${op.tableName}"`);
        for (const idxDdl of op.newIndexesDdl) {
          sqls.push(idxDdl);
        }
        sqls.push(`PRAGMA foreign_keys = ON`);
        sqls.push(`PRAGMA foreign_key_check`);
        break;
      }
      case "create_trigger":
        sqls.push(op.ddl);
        break;
      case "drop_trigger":
        sqls.push(`DROP TRIGGER IF EXISTS "${op.triggerName}"`);
        break;
    }
  }

  return sqls;
};

const buildUpBody = (ops: Array<SqliteSyncOperation>): Array<string> => {
  const lines: Array<string> = [];

  for (const op of ops) {
    switch (op.type) {
      case "create_table":
        lines.push(`// Create table "${op.tableName}"`);
        lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.ddl))}\`);`);
        break;

      case "add_column":
        lines.push(`// Add column on "${op.tableName}"`);
        lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.ddl))}\`);`);
        break;

      case "create_index":
        lines.push(`// Create index`);
        lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.ddl))}\`);`);
        break;

      case "drop_index":
        lines.push(`// Drop index "${op.indexName}"`);
        lines.push(`await runner.query(\`DROP INDEX IF EXISTS "${op.indexName}"\`);`);
        break;

      case "drop_table":
        lines.push(`// Drop table "${op.tableName}"`);
        lines.push(`await runner.query(\`DROP TABLE IF EXISTS "${op.tableName}"\`);`);
        break;

      case "recreate_table": {
        const tempName = extractTempTableName(op.newDdl) ?? `_new_${op.tableName}`;
        const selectCols = op.copyColumns.map((c) => `"${c}"`).join(", ");

        lines.push(`// Recreate table "${op.tableName}"`);
        lines.push(`await runner.query(\`PRAGMA foreign_keys = OFF\`);`);
        lines.push(`await runner.transaction(async (ctx) => {`);
        lines.push(`  await ctx.query(\`${escapeBacktick(normalizeSql(op.newDdl))}\`);`);
        lines.push(
          `  await ctx.query(\`INSERT INTO "${tempName}" SELECT ${escapeBacktick(selectCols)} FROM "${op.tableName}"\`);`,
        );
        lines.push(`  await ctx.query(\`DROP TABLE "${op.tableName}"\`);`);
        lines.push(
          `  await ctx.query(\`ALTER TABLE "${tempName}" RENAME TO "${op.tableName}"\`);`,
        );
        for (const idxDdl of op.newIndexesDdl) {
          lines.push(`  await ctx.query(\`${escapeBacktick(normalizeSql(idxDdl))}\`);`);
        }
        lines.push(`});`);
        lines.push(`await runner.query(\`PRAGMA foreign_keys = ON\`);`);
        lines.push(`await runner.query(\`PRAGMA foreign_key_check\`);`);
        break;
      }

      case "create_trigger":
        lines.push(`// Create trigger "${op.triggerName}"`);
        lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.ddl))}\`);`);
        break;

      case "drop_trigger":
        lines.push(`// Drop trigger "${op.triggerName}"`);
        lines.push(`await runner.query(\`DROP TRIGGER IF EXISTS "${op.triggerName}"\`);`);
        break;
    }

    lines.push("");
  }

  // Remove trailing blank line
  if (lines.length > 0 && lines[lines.length - 1] === "") {
    lines.pop();
  }

  return lines;
};

const buildDownSqlStrings = (ops: Array<SqliteSyncOperation>): Array<string> => {
  const sqls: Array<string> = [];
  const reversed = [...ops].reverse();

  for (const op of reversed) {
    switch (op.type) {
      case "create_table":
        sqls.push(`DROP TABLE IF EXISTS "${op.tableName}"`);
        break;

      case "create_index": {
        const indexName = extractIndexName(op.ddl);
        if (indexName) {
          sqls.push(`DROP INDEX IF EXISTS "${indexName}"`);
        }
        break;
      }

      case "add_column":
      case "drop_index":
      case "drop_table":
      case "recreate_table":
      case "drop_trigger":
        // Irreversible — emit empty string for checksum slot (matches MySQL pattern)
        sqls.push("");
        break;

      case "create_trigger":
        sqls.push(`DROP TRIGGER IF EXISTS "${op.triggerName}"`);
        break;
    }
  }

  return sqls;
};

const buildDownBody = (ops: Array<SqliteSyncOperation>): Array<string> => {
  const lines: Array<string> = [];
  const reversed = [...ops].reverse();

  for (const op of reversed) {
    switch (op.type) {
      case "create_table":
        lines.push(`await runner.query(\`DROP TABLE IF EXISTS "${op.tableName}"\`);`);
        break;

      case "create_index": {
        const indexName = extractIndexName(op.ddl);
        if (indexName) {
          lines.push(`await runner.query(\`DROP INDEX IF EXISTS "${indexName}"\`);`);
        } else {
          lines.push(`// WARN: irreversible — could not extract index name from DDL`);
        }
        break;
      }

      case "add_column":
        lines.push(
          `// WARN: irreversible — SQLite does not support DROP COLUMN via ALTER TABLE in all versions`,
        );
        break;

      case "drop_index":
        lines.push(
          `// WARN: irreversible — original index DDL not available for recreation`,
        );
        break;

      case "drop_table":
        lines.push(
          `// WARN: irreversible — original table DDL not available for recreation`,
        );
        break;

      case "recreate_table":
        lines.push(
          `// WARN: irreversible — recreate_table for "${op.tableName}" cannot be automatically reversed`,
        );
        break;

      case "create_trigger":
        lines.push(`await runner.query(\`DROP TRIGGER IF EXISTS "${op.triggerName}"\`);`);
        break;

      case "drop_trigger":
        lines.push(
          `// WARN: irreversible — original trigger DDL not available for recreation`,
        );
        break;
    }
  }

  return lines;
};

export const serializeSqliteMigration = (
  plan: SqliteSyncPlan,
  _snapshot: SqliteDbSnapshot,
  options: SerializeSqliteMigrationOptions = {},
): SerializedSqliteMigration => {
  const now = options.timestamp ?? new Date();
  const id = randomUUID();
  const ts = now.toISOString();
  const stamp = formatTimestamp(now);

  const nameSlug = options.name ? sanitizeName(options.name) : "generated";
  const className = options.name ? kebabToPascal(nameSlug) : `Generated${stamp}`;
  const filename = `${stamp}-${nameSlug}.ts`;

  const ops = plan.operations;

  // Compute checksum from normalized raw SQL (not TypeScript body fragments)
  const upSqlStrings = buildUpSqlStrings(ops).map(normalizeSql);
  const downSqlStrings = buildDownSqlStrings(ops).map(normalizeSql);
  const canonical = upSqlStrings.join("\n") + "\n---\n" + downSqlStrings.join("\n");
  const checksum = ShaKit.S256(canonical);

  // Build method bodies
  const upBody = buildUpBody(ops);
  const downBody = buildDownBody(ops);

  // Assemble file content
  const lines: Array<string> = [
    `import type { MigrationInterface, SqlMigrationRunner } from "@lindorm/proteus";`,
    ``,
    `export class ${className} implements MigrationInterface {`,
    `  public readonly id = "${id}";`,
    `  public readonly ts = "${ts}";`,
    `  public readonly driver = "sqlite";`,
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
