import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { randomBytes, randomUUID } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "pg";
import { mockScannerImport } from "../../../../__fixtures__/mock-scanner-import.js";
import { getEntityMetadata } from "../../../entity/metadata/get-entity-metadata.js";
import { PostgresDriver } from "./PostgresDriver.js";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

mockScannerImport();

const PG_CONNECTION = "postgres://root:example@localhost:5432/default";
const schema = `test_drv_mig_${randomBytes(6).toString("hex")}`;

let raw: Client;

beforeAll(async () => {
  raw = new Client({ connectionString: PG_CONNECTION });
  await raw.connect();
  await raw.query(`CREATE SCHEMA "${schema}"`);
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  // Clean all tables in the isolated schema between tests
  const result = await raw.query(
    `SELECT table_name FROM information_schema.tables
     WHERE table_schema = $1 AND table_type = 'BASE TABLE'`,
    [schema],
  );
  if (result.rows.length > 0) {
    await raw.query(`SET session_replication_role = 'replica'`);
    for (const row of result.rows) {
      await raw.query(
        `DROP TABLE IF EXISTS "${schema}"."${(row as any).table_name}" CASCADE`,
      );
    }
    await raw.query(`SET session_replication_role = 'origin'`);
  }

  // Also drop the migration tracking table in the schema (MigrationManager defaults to
  // creating it in the namespace schema when namespace is set via ensureMigrationTable).
  // Drop the public-schema migration table too, since some configurations may place it there.
  await raw.query(`DROP TABLE IF EXISTS "public"."proteus_migrations" CASCADE`);
  await raw.query(`DROP TABLE IF EXISTS "public"."custom_mig_tracking" CASCADE`);
});

// ─── Helpers ─────────────────────────────────────────────────────────────────

const writeMig = async (
  directory: string,
  filename: string,
  id: string,
  ts: string,
  upSql: string,
  downSql: string,
): Promise<void> => {
  const content = [
    `class Migration {`,
    `  id = ${JSON.stringify(id)};`,
    `  ts = ${JSON.stringify(ts)};`,
    `  async up(runner) { await runner.query(${JSON.stringify(upSql)}); }`,
    `  async down(runner) { await runner.query(${JSON.stringify(downSql)}); }`,
    `}`,
    `module.exports = { Migration };`,
  ].join("\n");
  await writeFile(join(directory, filename), content, "utf-8");
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("PostgresDriver migration (integration)", () => {
  it("should apply pending migrations during setup()", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-e1-"));

    try {
      await writeMig(
        dir,
        "20260220090000-create-users.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."e1_users" (id UUID PRIMARY KEY, name TEXT)`,
        `DROP TABLE IF EXISTS "${schema}"."e1_users"`,
      );

      const driver = new PostgresDriver(
        {
          driver: "postgres",
          url: PG_CONNECTION,

          runMigrations: true,
          migrations: [dir],
          logger: createMockLogger(),
        },
        createMockLogger(),
        schema,
        getEntityMetadata,
      );

      await driver.connect();

      try {
        await driver.setup([]);

        // Table created by migration
        const tables = await raw.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = $1 AND table_name = 'e1_users'`,
          [schema],
        );
        expect(tables.rows).toHaveLength(1);

        // Tracking record exists (migration table defaults to public schema)
        const tracking = await raw.query(
          `SELECT name, finished_at FROM "public"."proteus_migrations"`,
        );
        expect(tracking.rows).toHaveLength(1);
        expect(tracking.rows[0].name).toBe("20260220090000-create-users");
        expect(tracking.rows[0].finished_at).not.toBeNull();
      } finally {
        await driver.disconnect();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should apply migrations from multiple directories", async () => {
    const dir1 = await mkdtemp(join(tmpdir(), "proteus-e5a-"));
    const dir2 = await mkdtemp(join(tmpdir(), "proteus-e5b-"));

    try {
      await writeMig(
        dir1,
        "20260220090000-create-alpha.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."e5_alpha" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."e5_alpha"`,
      );
      await writeMig(
        dir2,
        "20260221090000-create-beta.js",
        randomUUID(),
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."e5_beta" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."e5_beta"`,
      );

      const driver = new PostgresDriver(
        {
          driver: "postgres",
          url: PG_CONNECTION,

          runMigrations: true,
          migrations: [dir1, dir2],
          logger: createMockLogger(),
        },
        createMockLogger(),
        schema,
        getEntityMetadata,
      );

      await driver.connect();

      try {
        await driver.setup([]);

        const tables = await raw.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = $1
             AND table_name IN ('e5_alpha', 'e5_beta')
           ORDER BY table_name`,
          [schema],
        );
        expect(tables.rows).toHaveLength(2);
        expect(tables.rows[0].table_name).toBe("e5_alpha");
        expect(tables.rows[1].table_name).toBe("e5_beta");
      } finally {
        await driver.disconnect();
      }
    } finally {
      await rm(dir1, { recursive: true, force: true });
      await rm(dir2, { recursive: true, force: true });
    }
  });

  it("should use custom migrationsTable name", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-e6-"));

    try {
      await writeMig(
        dir,
        "20260220090000-create-table.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `SELECT 1`,
        `SELECT 1`,
      );

      const driver = new PostgresDriver(
        {
          driver: "postgres",
          url: PG_CONNECTION,

          runMigrations: true,
          migrations: [dir],
          migrationsTable: "custom_mig_tracking",
          logger: createMockLogger(),
        },
        createMockLogger(),
        schema,
        getEntityMetadata,
      );

      await driver.connect();

      try {
        await driver.setup([]);

        // Custom tracking table should exist (in public schema by default)
        const custom = await raw.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'custom_mig_tracking'`,
        );
        expect(custom.rows).toHaveLength(1);

        // Default tracking table should NOT exist
        const defaultTbl = await raw.query(
          `SELECT table_name FROM information_schema.tables
           WHERE table_schema = 'public' AND table_name = 'proteus_migrations'`,
        );
        expect(defaultTbl.rows).toHaveLength(0);
      } finally {
        await driver.disconnect();
      }
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
