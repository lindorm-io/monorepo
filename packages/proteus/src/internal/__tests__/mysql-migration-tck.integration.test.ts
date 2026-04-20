import { afterAll, beforeAll, describe } from "vitest";
// MySQL Migration TCK Harness
//
// Runs the migration TCK suite against a real MySQL 8.4 instance.
// Creates a randomized database per run for parallel-safe execution.

import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import mysql from "mysql2/promise";
import type { Constructor } from "@lindorm/types";
import type { IEntity } from "../../interfaces";
import { mockScannerImport } from "../../__fixtures__/mock-scanner-import";
import { ProteusSource } from "../../classes/ProteusSource";
import { MySqlMigrationManager } from "../drivers/mysql/classes/MySqlMigrationManager";
import type { MysqlQueryClient } from "../drivers/mysql/types/mysql-query-client";
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

const MYSQL_HOST = process.env["MYSQL_HOST"] ?? "127.0.0.1";
const MYSQL_PORT = Number(process.env["MYSQL_PORT"] ?? 3306);
const MYSQL_DATABASE = `tck_${randomBytes(6).toString("hex")}`;
const MYSQL_USER = "root";
const MYSQL_PASSWORD = "example";

let client: MysqlQueryClient;
let conn: mysql.Connection;
let logger: ILogger;
const entities: MigrationTckEntities = createMigrationTckEntities();

const wrapMysqlConnection = (connection: mysql.Connection): MysqlQueryClient => ({
  query: async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
    const [rows] = await connection.query(sql, params);

    if (Array.isArray(rows)) {
      return {
        rows: rows as Array<R>,
        rowCount: rows.length,
        insertId: 0,
      };
    }

    return {
      rows: [] as Array<R>,
      rowCount: (rows as any).affectedRows ?? 0,
      insertId: Number((rows as any).insertId ?? 0),
    };
  },
});

beforeAll(async () => {
  logger = createMockLogger();

  // Wait for MySQL to be ready
  let ready = false;
  for (let attempt = 0; attempt < 30; attempt++) {
    try {
      const probe = await mysql.createConnection({
        host: MYSQL_HOST,
        port: MYSQL_PORT,
        user: MYSQL_USER,
        password: MYSQL_PASSWORD,
        connectTimeout: 2000,
      });
      await probe.execute("SELECT 1");
      await probe.end();
      ready = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 1000));
    }
  }
  if (!ready) {
    throw new Error("MySQL not ready after 30 connection attempts");
  }

  // Create isolated database for this test file
  const adminConn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  });
  await adminConn.execute(`CREATE DATABASE \`${MYSQL_DATABASE}\``);
  await adminConn.end();

  conn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
    database: MYSQL_DATABASE,
  });

  client = wrapMysqlConnection(conn);
});

afterAll(async () => {
  await conn.end();

  // Drop the isolated database
  const adminConn = await mysql.createConnection({
    host: MYSQL_HOST,
    port: MYSQL_PORT,
    user: MYSQL_USER,
    password: MYSQL_PASSWORD,
  });
  await adminConn.execute(`DROP DATABASE IF EXISTS \`${MYSQL_DATABASE}\``);
  await adminConn.end();
});

// ─── Context ──────────────────────────────────────────────────────────────────

const getCtx = (): MigrationTckContext => ({
  createManager: (directory: string) =>
    new MySqlMigrationManager({ client, directory, logger }),

  tableExists: async (tableName: string) => {
    const [rows] = await conn.execute(
      `SELECT 1 FROM information_schema.tables
       WHERE table_schema = ? AND table_name = ?`,
      [MYSQL_DATABASE, tableName],
    );
    return (rows as Array<unknown>).length > 0;
  },

  cleanSchema: async () => {
    await conn.execute("SET FOREIGN_KEY_CHECKS = 0");
    const [rows] = await conn.execute(
      `SELECT TABLE_NAME FROM information_schema.tables
       WHERE table_schema = ? AND table_type = 'BASE TABLE'`,
      [MYSQL_DATABASE],
    );
    for (const row of rows as Array<{ TABLE_NAME: string }>) {
      await conn.execute(`DROP TABLE IF EXISTS \`${row.TABLE_NAME}\``);
    }
    await conn.execute("SET FOREIGN_KEY_CHECKS = 1");
  },

  getMetadata: (ents: Array<Constructor<IEntity>>) =>
    ents.map((e) => getEntityMetadata(e)),

  getNamespaceOptions: () => ({}),

  seedSchema: async (ents: Array<Constructor<IEntity>>) => {
    const source = new ProteusSource({
      driver: "mysql",
      host: MYSQL_HOST,
      port: MYSQL_PORT,
      database: MYSQL_DATABASE,
      user: MYSQL_USER,
      password: MYSQL_PASSWORD,
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
    `CREATE TABLE \`${tableName}\` (id CHAR(36) PRIMARY KEY, marker TEXT)`,

  dropTableSql: (tableName) => `DROP TABLE IF EXISTS \`${tableName}\``,

  insertPartialRecord: async (opts) => {
    // Ensure migration table exists
    await conn.execute(`
      CREATE TABLE IF NOT EXISTS \`proteus_migrations\` (
        \`id\`             VARCHAR(255) NOT NULL PRIMARY KEY,
        \`name\`           VARCHAR(255) NOT NULL UNIQUE,
        \`checksum\`       VARCHAR(64) NOT NULL,
        \`created_at\`     DATETIME(3) NOT NULL,
        \`started_at\`     DATETIME(3) NOT NULL,
        \`finished_at\`    DATETIME(3) DEFAULT NULL,
        \`rolled_back_at\` DATETIME(3) DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    await conn.execute(
      `INSERT INTO \`proteus_migrations\` (\`id\`, \`name\`, \`checksum\`, \`created_at\`, \`started_at\`, \`finished_at\`)
       VALUES (?, ?, ?, NOW(3), NOW(3), NULL)`,
      [opts.id, opts.name, opts.checksum],
    );
  },
});

// ─── Suite ────────────────────────────────────────────────────────────────────

describe("Migration TCK: MySQL", () => {
  migrationsSuite(getCtx, entities);
});
