import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";
import { randomBytes, randomUUID } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type { MigrationTableOptions } from "../../types/migration.js";
import {
  deleteMigrationRecord,
  ensureMigrationTable,
  getAppliedMigrations,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table.js";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;
let tableOptions: MigrationTableOptions;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_mig_tbl_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  tableOptions = { schema };
});

describe("migration-table (integration)", () => {
  describe("ensureMigrationTable", () => {
    it("should create the migration table with correct columns", async () => {
      await ensureMigrationTable(client, tableOptions);

      const { rows } = await raw.query(
        `SELECT column_name, data_type, is_nullable
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'proteus_migrations'
         ORDER BY ordinal_position`,
        [schema],
      );

      expect(rows).toMatchSnapshot();
    });

    it("should be idempotent — calling twice produces no error", async () => {
      await ensureMigrationTable(client, tableOptions);
      await ensureMigrationTable(client, tableOptions);

      const { rows } = await raw.query(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'proteus_migrations'`,
        [schema],
      );

      expect(rows).toHaveLength(7);
    });

    it("should support custom schema and table name", async () => {
      const customOptions: MigrationTableOptions = { schema, table: "custom_tracking" };
      await ensureMigrationTable(client, customOptions);

      const { rows } = await raw.query(
        `SELECT column_name, data_type
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'custom_tracking'
         ORDER BY ordinal_position`,
        [schema],
      );

      expect(rows).toMatchSnapshot();
    });
  });

  describe("insertMigrationRecord", () => {
    it("should persist migration record with all fields", async () => {
      await ensureMigrationTable(client, tableOptions);

      const id = randomUUID();
      const createdAt = new Date("2026-02-20T09:00:00.000Z");
      const startedAt = new Date();

      await insertMigrationRecord(
        client,
        { id, name: "20260220090000-init", checksum: "abc123", createdAt, startedAt },
        tableOptions,
      );

      const { rows } = await raw.query(
        `SELECT * FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );

      expect(rows).toHaveLength(1);
      expect(rows[0].name).toBe("20260220090000-init");
      expect(rows[0].checksum).toBe("abc123");
      expect(new Date(rows[0].created_at).toISOString()).toBe("2026-02-20T09:00:00.000Z");
      expect(rows[0].finished_at).toBeNull();
      expect(rows[0].rolled_back_at).toBeNull();
    });

    it("should upsert on name conflict — update checksum and reset timestamps", async () => {
      await ensureMigrationTable(client, tableOptions);

      const id = randomUUID();
      const name = "20260220090000-init";

      await insertMigrationRecord(
        client,
        {
          id,
          name,
          checksum: "hash-v1",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      await markMigrationFinished(client, id, tableOptions);

      await insertMigrationRecord(
        client,
        {
          id,
          name,
          checksum: "hash-v2",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      const { rows } = await raw.query(
        `SELECT checksum, finished_at, rolled_back_at
         FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );

      expect(rows[0].checksum).toBe("hash-v2");
      expect(rows[0].finished_at).toBeNull();
      expect(rows[0].rolled_back_at).toBeNull();
    });
  });

  describe("getAppliedMigrations", () => {
    it("should return only finished, non-rolled-back migrations", async () => {
      await ensureMigrationTable(client, tableOptions);

      const id1 = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id: id1,
          name: "20260220090000-first",
          checksum: "h1",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );
      await markMigrationFinished(client, id1, tableOptions);

      const id2 = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id: id2,
          name: "20260221090000-second",
          checksum: "h2",
          createdAt: new Date("2026-02-21T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      const id3 = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id: id3,
          name: "20260222090000-third",
          checksum: "h3",
          createdAt: new Date("2026-02-22T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );
      await markMigrationFinished(client, id3, tableOptions);
      await markMigrationRolledBack(client, id3, tableOptions);

      const applied = await getAppliedMigrations(client, tableOptions);

      expect(applied).toHaveLength(1);
      expect(applied[0].id).toBe(id1);
      expect(applied[0].name).toBe("20260220090000-first");
    });
  });

  describe("markMigrationFinished", () => {
    it("should set finished_at timestamp", async () => {
      await ensureMigrationTable(client, tableOptions);

      const id = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id,
          name: "20260220090000-init",
          checksum: "h1",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      const before = await raw.query(
        `SELECT finished_at FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );
      expect(before.rows[0].finished_at).toBeNull();

      await markMigrationFinished(client, id, tableOptions);

      const after = await raw.query(
        `SELECT finished_at FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );
      expect(after.rows[0].finished_at).toBeInstanceOf(Date);
    });
  });

  describe("markMigrationRolledBack", () => {
    it("should set rolled_back_at and coalesce finished_at", async () => {
      await ensureMigrationTable(client, tableOptions);

      // Case 1: finished migration — COALESCE preserves original finished_at
      const id1 = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id: id1,
          name: "20260220090000-finished",
          checksum: "h1",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );
      await markMigrationFinished(client, id1, tableOptions);

      const beforeRollback = await raw.query(
        `SELECT finished_at FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id1],
      );
      const originalFinished: Date = beforeRollback.rows[0].finished_at;

      await markMigrationRolledBack(client, id1, tableOptions);

      const after1 = await raw.query(
        `SELECT finished_at, rolled_back_at
         FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id1],
      );
      expect(after1.rows[0].rolled_back_at).toBeInstanceOf(Date);
      expect(after1.rows[0].finished_at.getTime()).toBe(originalFinished.getTime());

      // Case 2: unfinished (crashed) migration — COALESCE fills in finished_at
      const id2 = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id: id2,
          name: "20260221090000-crashed",
          checksum: "h2",
          createdAt: new Date("2026-02-21T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      await markMigrationRolledBack(client, id2, tableOptions);

      const after2 = await raw.query(
        `SELECT finished_at, rolled_back_at
         FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id2],
      );
      expect(after2.rows[0].rolled_back_at).toBeInstanceOf(Date);
      expect(after2.rows[0].finished_at).toBeInstanceOf(Date);
    });
  });

  describe("deleteMigrationRecord", () => {
    it("should remove the migration record", async () => {
      await ensureMigrationTable(client, tableOptions);

      const id = randomUUID();
      await insertMigrationRecord(
        client,
        {
          id,
          name: "20260220090000-init",
          checksum: "h1",
          createdAt: new Date("2026-02-20T09:00:00.000Z"),
          startedAt: new Date(),
        },
        tableOptions,
      );

      const before = await raw.query(
        `SELECT id FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );
      expect(before.rows).toHaveLength(1);

      await deleteMigrationRecord(client, id, tableOptions);

      const after = await raw.query(
        `SELECT id FROM "${schema}"."proteus_migrations" WHERE "id" = $1`,
        [id],
      );
      expect(after.rows).toHaveLength(0);
    });
  });
});
