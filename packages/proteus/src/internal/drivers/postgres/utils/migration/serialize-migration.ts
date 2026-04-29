import {
  formatTimestamp,
  kebabToPascal,
  sanitizeName,
} from "../../../../cli/utils/migration-naming.js";
import { ShaKit } from "@lindorm/sha";
import { randomUUID } from "crypto";
import type { DbSnapshot } from "../../types/db-snapshot.js";
import type { SyncOperation, SyncPlan } from "../../types/sync-plan.js";
import { generateDownSql } from "./generate-down-sql.js";

export type SerializedMigration = {
  filename: string;
  content: string;
  checksum: string;
  id: string;
  ts: string;
};

export type SerializeMigrationOptions = {
  name?: string;
  timestamp?: Date;
};

type DownEntry = {
  sql: string | null;
  description: string;
  autocommit: boolean;
};

// Collapse all whitespace (newlines, tabs, runs of spaces) to single
// spaces for checksum stability. Whitespace inside SQL string literals
// (e.g. DEFAULT 'hello  world') is theoretically affected, but the
// DDL generators do not produce such values.
const normalizeSql = (sql: string): string => sql.replace(/\s+/g, " ").trim();

const escapeBacktick = (sql: string): string =>
  sql.replace(/\\/g, "\\\\").replace(/`/g, "\\`").replace(/\$/g, "\\$");

const indent = (line: string, level: number): string =>
  line ? " ".repeat(level) + line : "";

const buildUpBody = (
  txOps: Array<SyncOperation>,
  autocommitOps: Array<SyncOperation>,
): Array<string> => {
  const lines: Array<string> = [];

  if (txOps.length > 0) {
    lines.push("await runner.transaction(async (ctx) => {");
    for (const op of txOps) {
      lines.push(`  // ${op.description}`);
      lines.push(`  await ctx.query(\`${escapeBacktick(normalizeSql(op.sql))}\`);`);
    }
    lines.push("});");
  }

  if (autocommitOps.length > 0) {
    if (txOps.length > 0) lines.push("");
    for (const op of autocommitOps) {
      lines.push(`// ${op.description}`);
      lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(op.sql))}\`);`);
    }
  }

  return lines;
};

const buildDownBody = (
  autocommitEntries: Array<DownEntry>,
  txEntries: Array<DownEntry>,
): Array<string> => {
  const lines: Array<string> = [];

  for (const entry of autocommitEntries) {
    if (entry.sql) {
      lines.push(`await runner.query(\`${escapeBacktick(normalizeSql(entry.sql))}\`);`);
    } else {
      lines.push(`// WARN: irreversible — ${entry.description}`);
    }
  }

  const reversibleTx = txEntries.filter((e) => e.sql !== null);
  const irreversibleTx = txEntries.filter((e) => e.sql === null);

  if (irreversibleTx.length > 0) {
    if (lines.length > 0) lines.push("");
    if (reversibleTx.length === 0) {
      lines.push("// NOTE: all transactional operations in up() are irreversible");
    }
    for (const entry of irreversibleTx) {
      lines.push(`// WARN: irreversible — ${entry.description}`);
    }
  }

  if (reversibleTx.length > 0) {
    if (lines.length > 0) lines.push("");
    lines.push("await runner.transaction(async (ctx) => {");
    for (const entry of reversibleTx) {
      lines.push(`  await ctx.query(\`${escapeBacktick(normalizeSql(entry.sql!))}\`);`);
    }
    lines.push("});");
  }

  return lines;
};

export const serializeMigration = (
  plan: SyncPlan,
  snapshot: DbSnapshot,
  options: SerializeMigrationOptions = {},
): SerializedMigration => {
  const now = options.timestamp ?? new Date();
  const id = randomUUID();
  const ts = now.toISOString();
  const stamp = formatTimestamp(now);

  const nameSlug = options.name ? sanitizeName(options.name) : "generated";
  const className = options.name ? kebabToPascal(nameSlug) : `Generated${stamp}`;
  const filename = `${stamp}-${nameSlug}.ts`;

  // Filter out warn_only, separate tx vs autocommit
  const ops = plan.operations.filter((op) => op.type !== "warn_only");
  const txOps = ops.filter((op) => !op.autocommit);
  const autocommitOps = ops.filter((op) => op.autocommit);

  // Generate down entries for all ops
  const downEntries: Array<DownEntry> = ops.map((op) => ({
    sql: generateDownSql(op, snapshot),
    description: op.description,
    autocommit: op.autocommit,
  }));

  // Reversed for down method — undo autocommit first, then tx
  const reversed = [...downEntries].reverse();
  const reversedAutocommit = reversed.filter((e) => e.autocommit);
  const reversedTx = reversed.filter((e) => !e.autocommit);

  // Compute checksum from normalized SQL
  // Canonical format: up SQL joined by "\n", then "\n---\n", then down SQL (reversed) joined by "\n"
  const upSqlStrings = ops.map((op) => normalizeSql(op.sql));
  const downSqlStrings = reversed.map((e) => (e.sql ? normalizeSql(e.sql) : ""));
  const canonical = upSqlStrings.join("\n") + "\n---\n" + downSqlStrings.join("\n");
  const checksum = ShaKit.S256(canonical);

  // Build method bodies
  const upBody = buildUpBody(txOps, autocommitOps);
  const downBody = buildDownBody(reversedAutocommit, reversedTx);

  // Assemble file content
  const lines: Array<string> = [
    `import type { MigrationInterface, MigrationQueryRunner } from "@lindorm/proteus";`,
    ``,
    `export class ${className} implements MigrationInterface {`,
    `  public readonly id = "${id}";`,
    `  public readonly ts = "${ts}";`,
    ``,
    `  public async up(runner: MigrationQueryRunner): Promise<void> {`,
    ...upBody.map((line) => indent(line, 4)),
    `  }`,
    ``,
    `  public async down(runner: MigrationQueryRunner): Promise<void> {`,
    ...downBody.map((line) => indent(line, 4)),
    `  }`,
    `}`,
    ``,
  ];

  const content = lines.join("\n");

  return { filename, content, checksum, id, ts };
};
