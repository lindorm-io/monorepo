// Postgres Migration TCK Harness
//
// Runs the migration TCK suite against a real PostgreSQL instance.
// Uses a random schema for isolation; teardown drops the schema.

import { createMockLogger } from "@lindorm/logger";
import type { ILogger } from "@lindorm/logger";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import { Client } from "pg";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { mockScannerImport } from "../../__fixtures__/mock-scanner-import";
import { ProteusSource } from "../../classes/ProteusSource";
import { MigrationManager } from "../drivers/postgres/classes/MigrationManager";
import type { PostgresQueryClient } from "../drivers/postgres/types/postgres-query-client";
import type { MigrationTableOptions } from "../drivers/postgres/types/migration";
import { getEntityMetadata } from "../entity/metadata/get-entity-metadata";
import {
  createMigrationTckEntities,
  type MigrationTckEntities,
} from "../__fixtures__/tck/create-migration-tck-entities";
import {
  migrationsSuite,
  type MigrationTckContext,
} from "../__fixtures__/tck/migrations.tck";

mockScannerImport();

jest.setTimeout(120_000);

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;
let tableOptions: MigrationTableOptions;
let logger: ILogger;
const entities: MigrationTckEntities = createMigrationTckEntities();

beforeAll(async () => {
  schema = `tck_mig_${randomBytes(4).toString("hex")}`;
  logger = createMockLogger();

  raw = new Client({ connectionString: PG_CONNECTION });
  await raw.connect();

  client = {
    query: async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
      const result = await raw.query(sql, params);
      return { rows: result.rows as Array<R>, rowCount: result.rowCount ?? 0 };
    },
  };

  tableOptions = { schema };
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

// ─── Context ──────────────────────────────────────────────────────────────────

const getCtx = (): MigrationTckContext => ({
  createManager: (directory: string) =>
    new MigrationManager({ client, directory, logger, tableOptions }),

  tableExists: async (tableName: string) => {
    const { rows } = await raw.query(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, tableName],
    );
    return rows.length > 0;
  },

  cleanSchema: async () => {
    await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
    await raw.query(`CREATE SCHEMA "${schema}"`);
  },

  getMetadata: (ents: Array<Constructor<IEntity>>) =>
    ents.map((e) => getEntityMetadata(e)),

  getNamespaceOptions: () => ({ namespace: schema }),

  seedSchema: async (ents: Array<Constructor<IEntity>>) => {
    const source = new ProteusSource({
      driver: "postgres",
      url: PG_CONNECTION,
      namespace: schema,
      synchronize: true,
      entities: ents,
      logger: createMockLogger(),
    });
    await source.connect();
    await source.setup();
    await source.disconnect();
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
    `CREATE TABLE "${schema}"."${tableName}" (id UUID PRIMARY KEY, marker TEXT)`,

  dropTableSql: (tableName) => `DROP TABLE IF EXISTS "${schema}"."${tableName}"`,

  insertPartialRecord: async (opts) => {
    // Ensure migration table exists
    const qt = `"${schema}"."proteus_migrations"`;
    await raw.query(`CREATE SCHEMA IF NOT EXISTS "${schema}"`);
    await raw.query(`
      CREATE TABLE IF NOT EXISTS ${qt} (
        "id"             UUID        NOT NULL PRIMARY KEY,
        "name"           TEXT        NOT NULL UNIQUE,
        "checksum"       TEXT        NOT NULL,
        "created_at"     TIMESTAMPTZ NOT NULL,
        "started_at"     TIMESTAMPTZ NOT NULL DEFAULT now(),
        "finished_at"    TIMESTAMPTZ,
        "rolled_back_at" TIMESTAMPTZ
      )
    `);
    await raw.query(
      `INSERT INTO ${qt} ("id", "name", "checksum", "created_at", "started_at", "finished_at")
       VALUES ($1, $2, $3, NOW(), NOW(), NULL)`,
      [opts.id, opts.name, opts.checksum],
    );
  },
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Migration TCK: PostgreSQL", () => {
  migrationsSuite(getCtx, entities);
});
