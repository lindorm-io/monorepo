import { randomBytes } from "crypto";
import { mkdtemp, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import { TestChecked } from "../../../../__fixtures__/test-entities";
import { getEntityMetadata } from "#internal/entity/metadata/get-entity-metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { SyncPlanExecutor } from "../sync/execute-sync-plan";
import { diffSchema } from "../sync/diff-schema";
import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchema } from "../sync/project-desired-schema";
import { getAllMigrationRecords } from "./migration-table";
import { generateBaselineMigration } from "./generate-baseline-migration";

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_baseline_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
  await raw.end();
});

beforeEach(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS "${schema}" CASCADE`);
});

describe("generate-baseline-migration (integration)", () => {
  it("should generate baseline from empty DB without marking as applied", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-bl1-"));

    try {
      const metadata = getEntityMetadata(TestChecked);
      const nsOptions = { namespace: schema };

      const result = await generateBaselineMigration(client, [metadata], nsOptions, {
        directory: dir,
      });

      expect(result.operationCount).toBeGreaterThan(0);
      expect(result.markedAsApplied).toBe(false);
      expect(result.migration.filename).toMatch(/^\d{14}-baseline\.ts$/);
      expect(result.migration.content).toContain("TestChecked");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should mark baseline as applied when live DB matches desired schema", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-bl2-"));

    try {
      const metadata = getEntityMetadata(TestChecked);
      const nsOptions = { namespace: schema };

      // First, sync the DB to match the desired schema
      const desired = projectDesiredSchema([metadata], nsOptions);
      const managedTables = desired.tables.map((t) => ({
        schema: t.schema,
        name: t.name,
      }));
      const snapshot = await introspectSchema(client, managedTables);
      const plan = diffSchema(snapshot, desired);
      await new SyncPlanExecutor().execute(client, plan);

      // Generate baseline — should detect match and mark as applied
      const result = await generateBaselineMigration(client, [metadata], nsOptions, {
        directory: dir,
        tableOptions: { schema },
      });

      expect(result.operationCount).toBeGreaterThan(0);
      expect(result.markedAsApplied).toBe(true);

      // Verify tracking record exists and is finished
      const records = await getAllMigrationRecords(client, { schema });
      expect(records).toHaveLength(1);
      expect(records[0].name).toMatch(/^\d{14}-baseline$/);
      expect(records[0].finishedAt).toBeInstanceOf(Date);
      expect(records[0].rolledBackAt).toBeNull();
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });

  it("should use custom name when provided", async () => {
    const dir = await mkdtemp(join(tmpdir(), "proteus-bl3-"));

    try {
      const metadata = getEntityMetadata(TestChecked);
      const nsOptions = { namespace: schema };

      const result = await generateBaselineMigration(client, [metadata], nsOptions, {
        directory: dir,
        name: "initial-schema",
      });

      expect(result.migration.filename).toMatch(/^\d{14}-initial-schema\.ts$/);
      expect(result.migration.content).toContain("InitialSchema");
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
