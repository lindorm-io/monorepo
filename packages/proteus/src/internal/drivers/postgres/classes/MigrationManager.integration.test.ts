import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import type { ILogger } from "@lindorm/logger";
import { randomBytes, randomUUID } from "crypto";
import { mkdtemp, rm, writeFile } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "pg";
import { mockScannerImport } from "../../../../__fixtures__/mock-scanner-import.js";
import { hashNamespaceToInt32 } from "../../../utils/advisory-lock-name.js";
import { createTestPgClient } from "../../../__fixtures__/create-test-pg-client.js";
import type { PostgresQueryClient } from "../types/postgres-query-client.js";
import type { MigrationTableOptions } from "../types/migration.js";
import { withAdvisoryLock } from "../utils/advisory-lock.js";
import { getAllMigrationRecords } from "../utils/migration/migration-table.js";
import { MigrationManager } from "./MigrationManager.js";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from "vitest";

mockScannerImport();

// Advisory lock key pair — computed after schema is known (see beforeAll)
const MIGRATION_LOCK_KEY1 = 0x50524f54;
let MIGRATION_LOCK_KEY2: number;

let client: PostgresQueryClient;
let raw: Client;
let schema: string;
let tableOptions: MigrationTableOptions;
let dir: string;
let logger: ILogger;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_mgr_${randomBytes(6).toString("hex")}`;
  MIGRATION_LOCK_KEY2 = 0x4d494752 ^ hashNamespaceToInt32(schema);
  logger = createMockLogger();
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  tableOptions = { schema };
  dir = await mkdtemp(join(tmpdir(), "proteus-mgr-"));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
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

const writeFailingMig = async (
  directory: string,
  filename: string,
  id: string,
  ts: string,
): Promise<void> => {
  const content = [
    `class Migration {`,
    `  id = ${JSON.stringify(id)};`,
    `  ts = ${JSON.stringify(ts)};`,
    `  async up() { throw new Error("Simulated failure"); }`,
    `  async down() { }`,
    `}`,
    `module.exports = { Migration };`,
  ].join("\n");
  await writeFile(join(directory, filename), content, "utf-8");
};

const createManager = (directory?: string, opts?: MigrationTableOptions) =>
  new MigrationManager({
    client,
    directory: directory ?? dir,
    logger,
    namespace: schema,
    tableOptions: opts ?? tableOptions,
  });

const tableExists = async (tableName: string): Promise<boolean> => {
  const { rows } = await raw.query(
    `SELECT 1 FROM information_schema.tables
     WHERE table_schema = $1 AND table_name = $2`,
    [schema, tableName],
  );
  return rows.length > 0;
};

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("MigrationManager (integration)", () => {
  describe("apply", () => {
    it("should apply a single pending migration", async () => {
      const id = randomUUID();
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        id,
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );

      const manager = createManager();
      const result = await manager.apply();

      expect(result.applied).toHaveLength(1);
      expect(result.skipped).toBe(0);
      expect(await tableExists("t1")).toBe(true);

      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
      expect(records[0].finishedAt).toBeInstanceOf(Date);
    });

    it("should apply multiple migrations in filename order", async () => {
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );
      await writeMig(
        dir,
        "20260221090000-create-t2.js",
        randomUUID(),
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t2"`,
      );
      await writeMig(
        dir,
        "20260222090000-create-t3.js",
        randomUUID(),
        "2026-02-22T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t3" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t3"`,
      );

      const manager = createManager();
      const result = await manager.apply();

      expect(result.applied).toHaveLength(3);
      expect(result.applied[0].name).toBe("20260220090000-create-t1");
      expect(result.applied[1].name).toBe("20260221090000-create-t2");
      expect(result.applied[2].name).toBe("20260222090000-create-t3");
      expect(await tableExists("t1")).toBe(true);
      expect(await tableExists("t2")).toBe(true);
      expect(await tableExists("t3")).toBe(true);
    });

    it("should be idempotent — second apply skips all", async () => {
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );

      const manager = createManager();
      await manager.apply();

      const result = await manager.apply();

      expect(result.applied).toHaveLength(0);
      expect(result.skipped).toBe(1);

      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
    });

    it("should apply only new migrations when some already applied", async () => {
      const id1 = randomUUID();
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        id1,
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );

      const manager = createManager();
      await manager.apply();

      // Add a second migration
      await writeMig(
        dir,
        "20260221090000-create-t2.js",
        randomUUID(),
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t2"`,
      );

      const result = await manager.apply();

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].name).toBe("20260221090000-create-t2");
      expect(result.skipped).toBe(1);
    });

    it("should abort on checksum mismatch", async () => {
      const migId = randomUUID();
      const dir1 = await mkdtemp(join(tmpdir(), "proteus-c5a-"));
      const dir2 = await mkdtemp(join(tmpdir(), "proteus-c5b-"));

      try {
        // Original
        await writeMig(
          dir1,
          "20260220090000-init.js",
          migId,
          "2026-02-20T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t1"`,
        );

        const mgr1 = createManager(dir1);
        await mgr1.apply();

        // Tampered version with same ID but different SQL
        await writeMig(
          dir2,
          "20260220090000-init.js",
          migId,
          "2026-02-20T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t1_changed" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t1_changed"`,
        );

        const mgr2 = createManager(dir2);

        await expect(mgr2.apply()).rejects.toThrow("Checksum mismatch detected");
      } finally {
        await rm(dir1, { recursive: true, force: true });
        await rm(dir2, { recursive: true, force: true });
      }
    });

    it("should clean up orphan record on failure — first migration persists", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();

      await writeMig(
        dir,
        "20260220090000-first.js",
        id1,
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );
      await writeFailingMig(
        dir,
        "20260221090000-second.js",
        id2,
        "2026-02-21T09:00:00.000Z",
      );

      const manager = createManager();

      await expect(manager.apply()).rejects.toThrow("Migration up() failed");

      // First migration's table and record should persist
      expect(await tableExists("t1")).toBe(true);
      const records = await getAllMigrationRecords(client, tableOptions);
      expect(records).toHaveLength(1);
      expect(records[0].id).toBe(id1);
      expect(records[0].finishedAt).toBeInstanceOf(Date);
    });

    it("should re-apply only the failed migration after fix", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      const dir1 = await mkdtemp(join(tmpdir(), "proteus-c7a-"));
      const dir2 = await mkdtemp(join(tmpdir(), "proteus-c7b-"));

      try {
        // First file: identical in both dirs
        const firstContent = [
          `class Migration {`,
          `  id = ${JSON.stringify(id1)};`,
          `  ts = "2026-02-20T09:00:00.000Z";`,
          `  async up(runner) { await runner.query(${JSON.stringify(`CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`)}); }`,
          `  async down(runner) { await runner.query(${JSON.stringify(`DROP TABLE IF EXISTS "${schema}"."t1"`)}); }`,
          `}`,
          `module.exports = { Migration };`,
        ].join("\n");
        await writeFile(join(dir1, "20260220090000-first.js"), firstContent, "utf-8");
        await writeFile(join(dir2, "20260220090000-first.js"), firstContent, "utf-8");

        // Second file: fails in dir1, works in dir2
        await writeFailingMig(
          dir1,
          "20260221090000-second.js",
          id2,
          "2026-02-21T09:00:00.000Z",
        );
        await writeMig(
          dir2,
          "20260221090000-second.js",
          id2,
          "2026-02-21T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t2"`,
        );

        // First attempt — fails on second migration
        const mgr1 = createManager(dir1);
        await expect(mgr1.apply()).rejects.toThrow("Migration up() failed");

        // Retry with fixed dir — only second migration should run
        const mgr2 = createManager(dir2);
        const result = await mgr2.apply();

        expect(result.applied).toHaveLength(1);
        expect(result.applied[0].name).toBe("20260221090000-second");
        expect(result.skipped).toBe(1);
      } finally {
        await rm(dir1, { recursive: true, force: true });
        await rm(dir2, { recursive: true, force: true });
      }
    });
  });

  describe("status", () => {
    it("should report pending, applied, and checksum_mismatch", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();
      const dir1 = await mkdtemp(join(tmpdir(), "proteus-c8a-"));
      const dir2 = await mkdtemp(join(tmpdir(), "proteus-c8b-"));

      try {
        // Apply two migrations
        await writeMig(
          dir1,
          "20260220090000-first.js",
          id1,
          "2026-02-20T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t1"`,
        );
        await writeMig(
          dir1,
          "20260221090000-second.js",
          id2,
          "2026-02-21T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t2"`,
        );

        const mgr1 = createManager(dir1);
        await mgr1.apply();

        // Dir2: tamper first, keep second, add third (pending)
        await writeMig(
          dir2,
          "20260220090000-first.js",
          id1,
          "2026-02-20T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t1_tampered" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t1_tampered"`,
        );
        await writeMig(
          dir2,
          "20260221090000-second.js",
          id2,
          "2026-02-21T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t2"`,
        );
        await writeMig(
          dir2,
          "20260222090000-third.js",
          randomUUID(),
          "2026-02-22T09:00:00.000Z",
          `CREATE TABLE "${schema}"."t3" (id UUID PRIMARY KEY)`,
          `DROP TABLE IF EXISTS "${schema}"."t3"`,
        );

        const mgr2 = createManager(dir2);
        const status = await mgr2.status();

        const statuses = status.resolved.map((r) => ({ name: r.name, status: r.status }));
        expect(statuses).toEqual([
          { name: "20260220090000-first", status: "checksum_mismatch" },
          { name: "20260221090000-second", status: "applied" },
          { name: "20260222090000-third", status: "pending" },
        ]);
      } finally {
        await rm(dir1, { recursive: true, force: true });
        await rm(dir2, { recursive: true, force: true });
      }
    });
  });

  describe("rollback", () => {
    it("should roll back the most recently applied migration", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();

      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        id1,
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );
      await writeMig(
        dir,
        "20260221090000-create-t2.js",
        id2,
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t2"`,
      );

      const manager = createManager();
      await manager.apply();

      const result = await manager.rollback();

      expect(result.applied).toHaveLength(1);
      expect(result.applied[0].name).toBe("20260221090000-create-t2");

      // Second table gone, first still exists
      expect(await tableExists("t1")).toBe(true);
      expect(await tableExists("t2")).toBe(false);
    });

    it("should roll back N migrations in reverse order", async () => {
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );
      await writeMig(
        dir,
        "20260221090000-create-t2.js",
        randomUUID(),
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t2"`,
      );
      await writeMig(
        dir,
        "20260222090000-create-t3.js",
        randomUUID(),
        "2026-02-22T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t3" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t3"`,
      );

      const manager = createManager();
      await manager.apply();

      const result = await manager.rollback(2);

      expect(result.applied).toHaveLength(2);
      // Rolled back in reverse order
      expect(result.applied[0].name).toBe("20260222090000-create-t3");
      expect(result.applied[1].name).toBe("20260221090000-create-t2");

      expect(await tableExists("t1")).toBe(true);
      expect(await tableExists("t2")).toBe(false);
      expect(await tableExists("t3")).toBe(false);
    });

    it("should apply → rollback → re-apply via upsert path", async () => {
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );

      const manager = createManager();

      await manager.apply();
      expect(await tableExists("t1")).toBe(true);

      await manager.rollback();
      expect(await tableExists("t1")).toBe(false);

      // Re-apply — upsert resets the tracking record
      const result = await manager.apply();
      expect(result.applied).toHaveLength(1);
      expect(await tableExists("t1")).toBe(true);
    });
  });

  describe("getRecords", () => {
    it("should return records with all states", async () => {
      const id1 = randomUUID();
      const id2 = randomUUID();

      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        id1,
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );
      await writeMig(
        dir,
        "20260221090000-create-t2.js",
        id2,
        "2026-02-21T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t2" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t2"`,
      );

      const manager = createManager();
      await manager.apply();
      await manager.rollback(); // rolls back second only

      const records = await manager.getRecords();

      expect(records).toHaveLength(2);

      // First: still applied
      const first = records.find((r) => r.id === id1)!;
      expect(first.finishedAt).toBeInstanceOf(Date);
      expect(first.rolledBackAt).toBeNull();

      // Second: rolled back
      const second = records.find((r) => r.id === id2)!;
      expect(second.rolledBackAt).toBeInstanceOf(Date);
    });
  });

  describe("custom tableOptions", () => {
    it("should use custom schema and table for tracking", async () => {
      const customOpts: MigrationTableOptions = { schema, table: "custom_mig_tbl" };

      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `CREATE TABLE "${schema}"."t1" (id UUID PRIMARY KEY)`,
        `DROP TABLE IF EXISTS "${schema}"."t1"`,
      );

      const manager = new MigrationManager({
        client,
        directory: dir,
        logger,
        tableOptions: customOpts,
      });

      await manager.apply();

      // Custom tracking table should exist
      const { rows: customRows } = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'custom_mig_tbl'`,
        [schema],
      );
      expect(customRows).toHaveLength(1);

      // Default tracking table should NOT exist
      const { rows: defaultRows } = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_name = 'proteus_migrations'`,
        [schema],
      );
      expect(defaultRows).toHaveLength(0);

      // Migration itself should have run
      expect(await tableExists("t1")).toBe(true);
    });
  });

  describe("advisory lock concurrency", () => {
    let clientB: PostgresQueryClient;
    let rawB: Client;

    beforeAll(async () => {
      ({ client: clientB, raw: rawB } = await createTestPgClient());
    });

    afterAll(async () => {
      await rawB.end();
    });

    it("should throw when another connection holds the migration lock", async () => {
      await writeMig(
        dir,
        "20260220090000-create-t1.js",
        randomUUID(),
        "2026-02-20T09:00:00.000Z",
        `SELECT 1`,
        `SELECT 1`,
      );

      // Hold the lock on client A
      const lockResult = await withAdvisoryLock(
        client,
        MIGRATION_LOCK_KEY1,
        MIGRATION_LOCK_KEY2,
        async () => {
          // While lock is held, try apply on client B
          const manager = new MigrationManager({
            client: clientB,
            directory: dir,
            logger,
            namespace: schema,
            tableOptions,
          });

          await expect(manager.apply()).rejects.toThrow(
            "Could not acquire migration advisory lock",
          );
          return "done";
        },
      );

      expect(lockResult).toBe("done");
    });

    it("should release lock after failure — allowing retry", async () => {
      const failDir = await mkdtemp(join(tmpdir(), "proteus-d2-fail-"));
      const okDir = await mkdtemp(join(tmpdir(), "proteus-d2-ok-"));

      try {
        await writeFailingMig(
          failDir,
          "20260220090000-fail.js",
          randomUUID(),
          "2026-02-20T09:00:00.000Z",
        );

        await writeMig(
          okDir,
          "20260220090000-ok.js",
          randomUUID(),
          "2026-02-20T09:00:00.000Z",
          `SELECT 1`,
          `SELECT 1`,
        );

        // First attempt fails — lock should be released
        const failManager = createManager(failDir);
        await expect(failManager.apply()).rejects.toThrow("Migration up() failed");

        // If lock wasn't released, this would also fail
        const okManager = createManager(okDir);
        const result = await okManager.apply();

        expect(result.applied).toHaveLength(1);
      } finally {
        await rm(failDir, { recursive: true, force: true });
        await rm(okDir, { recursive: true, force: true });
      }
    });
  });
});
