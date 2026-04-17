import { randomBytes } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import { TestChecked, TestIndexed } from "../../../../__fixtures__/test-entities";
import { getEntityMetadata } from "../../../../entity/metadata/get-entity-metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { diffSchema } from "../sync/diff-schema";
import { SyncPlanExecutor } from "../sync/execute-sync-plan";
import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchema } from "../sync/project-desired-schema";
import { generateMigration } from "./generate-migration";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_gen_mig_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
});

describe("generate-migration (integration)", () => {
  it("should generate migration from empty DB and capture all operations", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-f1-"));

    try {
      const metadata = getEntityMetadata(TestChecked);
      const nsOptions = { namespace: schema };

      const result = await generateMigration(client, [metadata], nsOptions, {
        directory: dir,
        name: "init",
      });

      expect(result.isEmpty).toBe(false);
      expect(result.operationCount).toBeGreaterThan(0);
      expect(result.migration.filename).toMatch(/^\d{14}-init\.ts$/);
      expect(result.migration.content).toContain("class Init");
      expect(result.migration.content).toContain("TestChecked");

      // Apply via sync to verify the operations produce the correct schema
      const desired = projectDesiredSchema([metadata], nsOptions);
      const managedTables = desired.tables.map((t) => ({
        schema: t.schema,
        name: t.name,
      }));
      const snapshot = await introspectSchema(client, managedTables);
      const plan = diffSchema(snapshot, desired);
      await new SyncPlanExecutor(undefined, schema).execute(client, plan);

      // Verify table exists with expected columns
      const { rows } = await raw.query(
        `SELECT column_name FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = 'TestChecked'
         ORDER BY ordinal_position`,
        [schema],
      );

      expect(rows.length).toBeGreaterThan(0);
      expect(rows.map((r: any) => r.column_name)).toMatchSnapshot();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should generate delta migration after schema evolution", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-f2-"));

    try {
      const nsOptions = { namespace: schema };
      const metaChecked = getEntityMetadata(TestChecked);

      // First: apply TestChecked via sync
      const desired1 = projectDesiredSchema([metaChecked], nsOptions);
      const managed1 = desired1.tables.map((t) => ({ schema: t.schema, name: t.name }));
      const snap1 = await introspectSchema(client, managed1);
      const plan1 = diffSchema(snap1, desired1);
      await new SyncPlanExecutor(undefined, schema).execute(client, plan1);

      // Generate migration for TestChecked + TestIndexed (delta = TestIndexed only)
      const metaIndexed = getEntityMetadata(TestIndexed);

      const result = await generateMigration(
        client,
        [metaChecked, metaIndexed],
        nsOptions,
        {
          directory: dir,
          name: "add-indexed",
        },
      );

      expect(result.isEmpty).toBe(false);
      expect(result.operationCount).toBeGreaterThan(0);
      expect(result.migration.content).toContain("TestIndexed");

      // Apply delta via sync
      const desired2 = projectDesiredSchema([metaChecked, metaIndexed], nsOptions);
      const managed2 = desired2.tables.map((t) => ({ schema: t.schema, name: t.name }));
      const snap2 = await introspectSchema(client, managed2);
      const plan2 = diffSchema(snap2, desired2);
      await new SyncPlanExecutor(undefined, schema).execute(client, plan2);

      // Both tables should exist
      const { rows } = await raw.query(
        `SELECT table_name FROM information_schema.tables
         WHERE table_schema = $1 AND table_type = 'BASE TABLE'
         ORDER BY table_name`,
        [schema],
      );
      const tables = rows.map((r: any) => r.table_name);
      expect(tables).toContain("TestChecked");
      expect(tables).toContain("TestIndexed");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should generate empty migration when schema already matches", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-f3-"));

    try {
      const nsOptions = { namespace: schema };
      const metadata = getEntityMetadata(TestChecked);

      // Apply via sync first
      const desired = projectDesiredSchema([metadata], nsOptions);
      const managed = desired.tables.map((t) => ({ schema: t.schema, name: t.name }));
      const snap1 = await introspectSchema(client, managed);
      const plan1 = diffSchema(snap1, desired);
      await new SyncPlanExecutor(undefined, schema).execute(client, plan1);

      // Generate migration — should be empty
      const result = await generateMigration(client, [metadata], nsOptions, {
        directory: dir,
        name: "no-op",
      });

      expect(result.isEmpty).toBe(true);
      expect(result.operationCount).toBe(0);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
