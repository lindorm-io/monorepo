import { afterAll, beforeAll, describe, vi } from "vitest";
// SQLite Migration TCK Harness
//
// Runs the migration TCK suite against the SQLite driver.
// No external services required — uses a temp file database.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { randomUUID } from "node:crypto";
import { writeFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces/index.js";
import { mockScannerImport } from "../../__fixtures__/mock-scanner-import.js";
import { SqliteMigrationManager } from "../drivers/sqlite/classes/SqliteMigrationManager.js";
import { SyncPlanExecutor } from "../drivers/sqlite/utils/sync/execute-sync-plan.js";
import { diffSchema } from "../drivers/sqlite/utils/sync/diff-schema.js";
import { introspectSchema } from "../drivers/sqlite/utils/sync/introspect-schema.js";
import { projectDesiredSchemaSqlite } from "../drivers/sqlite/utils/sync/project-desired-schema-sqlite.js";
import type {
  SqliteQueryClient,
  SqliteRow,
} from "../drivers/sqlite/types/sqlite-query-client.js";
import { getEntityMetadata } from "../entity/metadata/get-entity-metadata.js";
import {
  createMigrationTckEntities,
  type MigrationTckEntities,
} from "../__fixtures__/tck/create-migration-tck-entities.js";
import {
  migrationsSuite,
  type MigrationTckContext,
} from "../__fixtures__/tck/migrations.tck.js";

mockScannerImport();

vi.setConfig({ testTimeout: 120_000 });

let db: SqliteQueryClient;
let dbPath: string;
let logger: ILogger;
const entities: MigrationTckEntities = createMigrationTckEntities();

const openDb = async (): Promise<SqliteQueryClient> => {
  const BetterSqlite3 = await import("better-sqlite3");
  const Database = BetterSqlite3.default ?? BetterSqlite3;
  const database = new Database(dbPath);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");

  return {
    run: (sql: string, params?: ReadonlyArray<unknown>) =>
      database.prepare(sql).run(params ?? []),
    all: (sql: string, params?: ReadonlyArray<unknown>) =>
      database.prepare(sql).all(params ?? []) as Array<SqliteRow>,
    get: (sql: string, params?: ReadonlyArray<unknown>) =>
      database.prepare(sql).get(params ?? []) as SqliteRow | undefined,
    exec: (sql: string) => database.exec(sql),
    iterate: (sql: string, params?: ReadonlyArray<unknown>) =>
      database.prepare(sql).iterate(params ?? []) as IterableIterator<SqliteRow>,
    close: () => database.close(),
    get open() {
      return database.open;
    },
    get name() {
      return database.name;
    },
  };
};

beforeAll(async () => {
  logger = createMockLogger();
  dbPath = join(tmpdir(), `proteus-mig-tck-${randomUUID()}.db`);
  db = await openDb();
});

afterAll(async () => {
  try {
    db.close();
  } catch {
    /* already closed */
  }
  await rm(dbPath, { force: true }).catch(() => {});
});

// ─── Context ──────────────────────────────────────────────────────────────────

const getCtx = (): MigrationTckContext => ({
  createManager: (directory: string) =>
    new SqliteMigrationManager({ client: db, directory, logger }),

  tableExists: async (tableName: string) => {
    const row = db.get(`SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?`, [
      tableName,
    ]);
    return row !== undefined;
  },

  cleanSchema: async () => {
    // Close, delete, reopen
    try {
      db.close();
    } catch {
      /* already closed */
    }
    await rm(dbPath, { force: true }).catch(() => {});
    db = await openDb();
  },

  getMetadata: (ents: Array<Constructor<IEntity>>) =>
    ents.map((e) => getEntityMetadata(e)),

  getNamespaceOptions: () => ({}),

  seedSchema: async (ents: Array<Constructor<IEntity>>) => {
    const metadatas = ents.map((e) => getEntityMetadata(e));
    const desired = projectDesiredSchemaSqlite(metadatas, {});
    const managedTableNames = desired.tables.map((t) => t.name);
    const snapshot = introspectSchema(db, managedTableNames);
    const plan = diffSchema(snapshot, desired);
    new SyncPlanExecutor().execute(db, plan);
  },

  supportsGeneration: true,

  writeMigration: async (dir, filename, opts) => {
    const content = [
      `class Migration {`,
      `  id = ${JSON.stringify(opts.id)};`,
      `  ts = ${JSON.stringify(opts.ts)};`,
      `  async up(runner) { await runner.query(${JSON.stringify(opts.upSql)}); }`,
      `  async down(runner) { await runner.query(${JSON.stringify(opts.downSql)}); }`,
      `}`,
      `module.exports = { Migration };`,
    ].join("\n");
    await writeFile(join(dir, filename), content, "utf-8");
  },

  writeFailingMigration: async (dir, filename, opts) => {
    const content = [
      `class Migration {`,
      `  id = ${JSON.stringify(opts.id)};`,
      `  ts = ${JSON.stringify(opts.ts)};`,
      `  async up() { throw new Error("Simulated failure"); }`,
      `  async down() { }`,
      `}`,
      `module.exports = { Migration };`,
    ].join("\n");
    await writeFile(join(dir, filename), content, "utf-8");
  },

  writeFailingDownMigration: async (dir, filename, opts) => {
    const content = [
      `class Migration {`,
      `  id = ${JSON.stringify(opts.id)};`,
      `  ts = ${JSON.stringify(opts.ts)};`,
      `  async up(runner) { await runner.query(${JSON.stringify(opts.upSql)}); }`,
      `  async down() { throw new Error("Simulated down() failure"); }`,
      `}`,
      `module.exports = { Migration };`,
    ].join("\n");
    await writeFile(join(dir, filename), content, "utf-8");
  },

  createTableSql: (tableName) =>
    `CREATE TABLE "${tableName}" (id TEXT PRIMARY KEY, marker TEXT)`,

  dropTableSql: (tableName) => `DROP TABLE IF EXISTS "${tableName}"`,

  insertPartialRecord: async (opts) => {
    // Ensure migration table exists
    db.exec(`
      CREATE TABLE IF NOT EXISTS "proteus_migrations" (
        "id"             TEXT NOT NULL PRIMARY KEY,
        "name"           TEXT NOT NULL UNIQUE,
        "checksum"       TEXT NOT NULL,
        "created_at"     TEXT NOT NULL,
        "started_at"     TEXT NOT NULL,
        "finished_at"    TEXT,
        "rolled_back_at" TEXT
      )
    `);
    db.run(
      `INSERT INTO "proteus_migrations" ("id", "name", "checksum", "created_at", "started_at", "finished_at")
       VALUES (?, ?, ?, datetime('now'), datetime('now'), NULL)`,
      [opts.id, opts.name, opts.checksum],
    );
  },
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Migration TCK: SQLite", () => {
  migrationsSuite(getCtx, entities);
});
