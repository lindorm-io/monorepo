import { ShaKit } from "@lindorm/sha";
import { randomBytes, randomUUID } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import type { MigrationInterface, MigrationTableOptions } from "../../types/migration";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { executeMigrationDown, executeMigrationUp } from "./execute-migration";
import { getAllMigrationRecords } from "./migration-table";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;
let tableOptions: MigrationTableOptions;

const computeHash = (m: MigrationInterface): string =>
  ShaKit.S256(m.up.toString() + "\n---\n" + m.down.toString());

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_exec_mig_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  tableOptions = { schema };
});

describe("execute-migration (integration)", () => {
  describe("executeMigrationUp", () => {
    it("should execute up() with runner.transaction() and mark finished", async () => {
      const id = randomUUID();
      const migration: MigrationInterface = {
        id,
        ts: "2026-02-20T09:00:00.000Z",
        up: async (runner) => {
          await runner.transaction(async (ctx) => {
            await ctx.query(
              `CREATE TABLE "${schema}"."b1_table" (id UUID PRIMARY KEY, name TEXT)`,
            );
          });
        },
        down: async (runner) => {
          await runner.transaction(async (ctx) => {
            await ctx.query(`DROP TABLE IF EXISTS "${schema}"."b1_table"`);
          });
        },
      };

      const result = await executeMigrationUp(
        client,
        migration,
        { name: "20260220090000-b1", checksum: computeHash(migration) },
        tableOptions,
      );

      expect(result.name).toBe("20260220090000-b1");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Verify table exists
      const tables = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'b1_table'`,
        [schema],
      );
      expect(tables.rows).toHaveLength(1);

      // Verify tracking record is finished
      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
      expect(records[0].finishedAt).toBeInstanceOf(Date);
      expect(records[0].rolledBackAt).toBeNull();
    });

    it("should execute up() with runner.query() autocommit", async () => {
      const id = randomUUID();
      const migration: MigrationInterface = {
        id,
        ts: "2026-02-20T09:00:00.000Z",
        up: async (runner) => {
          await runner.query(`CREATE TABLE "${schema}"."b2_table" (id UUID PRIMARY KEY)`);
        },
        down: async (runner) => {
          await runner.query(`DROP TABLE IF EXISTS "${schema}"."b2_table"`);
        },
      };

      await executeMigrationUp(
        client,
        migration,
        { name: "20260220090000-b2", checksum: computeHash(migration) },
        tableOptions,
      );

      const tables = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'b2_table'`,
        [schema],
      );
      expect(tables.rows).toHaveLength(1);
    });

    it("should roll back transaction on error and clean up orphan record", async () => {
      const id = randomUUID();
      const migration: MigrationInterface = {
        id,
        ts: "2026-02-20T09:00:00.000Z",
        up: async (runner) => {
          await runner.transaction(async (ctx) => {
            await ctx.query(`CREATE TABLE "${schema}"."b3_table" (id UUID PRIMARY KEY)`);
            throw new Error("Simulated failure");
          });
        },
        down: async () => {},
      };

      await expect(
        executeMigrationUp(
          client,
          migration,
          { name: "20260220090000-b3", checksum: computeHash(migration) },
          tableOptions,
        ),
      ).rejects.toThrow("Migration up() failed");

      // Table should NOT exist (transaction rolled back)
      const tables = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'b3_table'`,
        [schema],
      );
      expect(tables.rows).toHaveLength(0);

      // Orphan record should be deleted
      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(0);
    });
  });

  describe("executeMigrationDown", () => {
    it("should execute down() and mark rolled back", async () => {
      const id = randomUUID();
      const migration: MigrationInterface = {
        id,
        ts: "2026-02-20T09:00:00.000Z",
        up: async (runner) => {
          await runner.transaction(async (ctx) => {
            await ctx.query(`CREATE TABLE "${schema}"."b4_table" (id UUID PRIMARY KEY)`);
          });
        },
        down: async (runner) => {
          await runner.transaction(async (ctx) => {
            await ctx.query(`DROP TABLE IF EXISTS "${schema}"."b4_table"`);
          });
        },
      };

      // First apply
      await executeMigrationUp(
        client,
        migration,
        { name: "20260220090000-b4", checksum: computeHash(migration) },
        tableOptions,
      );

      // Then roll back
      const result = await executeMigrationDown(
        client,
        migration,
        { name: "20260220090000-b4" },
        tableOptions,
      );

      expect(result.name).toBe("20260220090000-b4");
      expect(result.durationMs).toBeGreaterThanOrEqual(0);

      // Table should be gone
      const tables = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'b4_table'`,
        [schema],
      );
      expect(tables.rows).toHaveLength(0);

      // Record should have rolled_back_at set
      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
      expect(records[0].rolledBackAt).toBeInstanceOf(Date);
    });

    it("should NOT delete record when down() fails", async () => {
      const id = randomUUID();
      const migration: MigrationInterface = {
        id,
        ts: "2026-02-20T09:00:00.000Z",
        up: async (runner) => {
          await runner.query(`CREATE TABLE "${schema}"."b5_table" (id UUID PRIMARY KEY)`);
        },
        down: async () => {
          throw new Error("Down failed");
        },
      };

      await executeMigrationUp(
        client,
        migration,
        { name: "20260220090000-b5", checksum: computeHash(migration) },
        tableOptions,
      );

      await expect(
        executeMigrationDown(
          client,
          migration,
          { name: "20260220090000-b5" },
          tableOptions,
        ),
      ).rejects.toThrow("Migration down() failed");

      // Record should still exist (NOT deleted — contrast with up path)
      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
      expect(records[0].finishedAt).toBeInstanceOf(Date);
      expect(records[0].rolledBackAt).toBeNull();
    });
  });
});
