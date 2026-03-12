import {
  formatTimestamp,
  kebabToPascal,
  sanitizeName,
} from "#internal/cli/utils/migration-naming";
import { ShaKit } from "@lindorm/sha";
import { randomUUID } from "crypto";
import type { MongoSyncPlan, DesiredMongoIndex } from "../sync/types";

export type SerializedMongoMigration = {
  filename: string;
  content: string;
  checksum: string;
  id: string;
  ts: string;
};

export type SerializeMongoMigrationOptions = {
  name?: string;
  timestamp?: Date;
};

const indent = (line: string, level: number): string =>
  line ? " ".repeat(level) + line : "";

const formatIndexKeys = (keys: Record<string, 1 | -1>): string => {
  const entries = Object.entries(keys)
    .map(([k, v]) => `${JSON.stringify(k)}: ${v}`)
    .join(", ");
  return `{ ${entries} }`;
};

const formatIndexOptions = (idx: DesiredMongoIndex): string => {
  const opts: Array<string> = [`name: ${JSON.stringify(idx.name)}`];
  if (idx.unique) opts.push("unique: true");
  if (idx.sparse) opts.push("sparse: true");
  if (idx.expireAfterSeconds != null)
    opts.push(`expireAfterSeconds: ${idx.expireAfterSeconds}`);
  return `{ ${opts.join(", ")} }`;
};

const buildUpBody = (plan: MongoSyncPlan): Array<string> => {
  const lines: Array<string> = [];

  // Create collections
  for (const collName of plan.collectionsToCreate) {
    lines.push(`// Create collection "${collName}"`);
    lines.push(
      `await runner.db().createCollection(${JSON.stringify(collName)}).catch((e) => {`,
    );
    lines.push(`  if (e?.code !== 48) throw e; // Ignore "already exists"`);
    lines.push(`});`);
  }

  // Drop indexes
  for (const { collection, name } of plan.indexesToDrop) {
    lines.push(`// Drop index "${name}" from "${collection}"`);
    lines.push(
      `await runner.collection(${JSON.stringify(collection)}).dropIndex(${JSON.stringify(name)}).catch((e) => {`,
    );
    lines.push(`  if (e?.code !== 27) throw e; // Ignore "not found"`);
    lines.push(`});`);
  }

  // Create indexes
  for (const idx of plan.indexesToCreate) {
    lines.push(`// Create index "${idx.name}" on "${idx.collection}"`);
    lines.push(`await runner.collection(${JSON.stringify(idx.collection)}).createIndex(`);
    lines.push(`  ${formatIndexKeys(idx.keys)},`);
    lines.push(`  ${formatIndexOptions(idx)},`);
    lines.push(`);`);
  }

  return lines;
};

const buildDownBody = (plan: MongoSyncPlan): Array<string> => {
  const lines: Array<string> = [];

  // Reverse order: drop created indexes, re-create dropped indexes (not possible without original spec),
  // drop created collections

  // Drop indexes that were created in up()
  for (const idx of [...plan.indexesToCreate].reverse()) {
    lines.push(
      `await runner.collection(${JSON.stringify(idx.collection)}).dropIndex(${JSON.stringify(idx.name)}).catch((e) => {`,
    );
    lines.push(`  if (e?.code !== 27) throw e; // Ignore "not found"`);
    lines.push(`});`);
  }

  // Re-create indexes that were dropped in up() — we have the spec from the desired state
  // that caused the drop, but the *original* spec is not available in the plan.
  // Mark as irreversible.
  for (const { collection, name } of [...plan.indexesToDrop].reverse()) {
    lines.push(
      `// WARN: cannot recreate previously dropped index "${name}" on "${collection}" — original spec unknown`,
    );
  }

  // Drop collections that were created in up()
  for (const collName of [...plan.collectionsToCreate].reverse()) {
    lines.push(
      `await runner.db().dropCollection(${JSON.stringify(collName)}).catch((e) => {`,
    );
    lines.push(`  if (e?.code !== 26) throw e; // Ignore "ns not found"`);
    lines.push(`});`);
  }

  return lines;
};

export const serializeMongoMigration = (
  plan: MongoSyncPlan,
  options: SerializeMongoMigrationOptions = {},
): SerializedMongoMigration => {
  const now = options.timestamp ?? new Date();
  const id = randomUUID();
  const ts = now.toISOString();
  const stamp = formatTimestamp(now);

  const nameSlug = options.name ? sanitizeName(options.name) : "generated";
  const className = options.name ? kebabToPascal(nameSlug) : `Generated${stamp}`;
  const filename = `${stamp}-${nameSlug}.ts`;

  const upBody = buildUpBody(plan);
  const downBody = buildDownBody(plan);

  // Compute checksum from the serialized up+down bodies
  const canonical = upBody.join("\n") + "\n---\n" + downBody.join("\n");
  const checksum = ShaKit.S256(canonical);

  const lines: Array<string> = [
    `import type { MigrationInterface } from "@lindorm/proteus";`,
    ``,
    `export class ${className} implements MigrationInterface {`,
    `  public readonly id = "${id}";`,
    `  public readonly ts = "${ts}";`,
    `  public readonly driver = "mongo";`,
    ``,
    `  public async up(runner: any): Promise<void> {`,
    ...upBody.map((line) => indent(line, 4)),
    `  }`,
    ``,
    `  public async down(runner: any): Promise<void> {`,
    ...downBody.map((line) => indent(line, 4)),
    `  }`,
    `}`,
    ``,
  ];

  const content = lines.join("\n");

  return { filename, content, checksum, id, ts };
};
