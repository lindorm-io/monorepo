import type { SqliteDbSnapshot } from "../../types/db-snapshot.js";
import type { SqliteSyncOperation, SqliteSyncPlan } from "../../types/sync-plan.js";
import { describe, expect, test, vi, type Mock } from "vitest";

// Mock crypto.randomUUID for deterministic IDs
vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn(() => "00000000-0000-0000-0000-000000000000"),
}));

// Mock ShaKit for deterministic checksums
vi.mock("@lindorm/sha", () => ({
  ShaKit: { S256: vi.fn(() => "mocked-checksum-sha256") },
}));

import { serializeSqliteMigration } from "./serialize-sqlite-migration.js";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FIXED_DATE = new Date("2025-06-15T10:30:45.000Z");

const emptySnapshot: SqliteDbSnapshot = { tables: new Map() };

const makePlan = (operations: Array<SqliteSyncOperation>): SqliteSyncPlan => ({
  operations,
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("serializeSqliteMigration", () => {
  describe("metadata", () => {
    test("should produce deterministic filename, id, ts, and checksum", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "users",
          ddl: 'CREATE TABLE "users" ("id" TEXT PRIMARY KEY);',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.filename).toMatchSnapshot();
      expect(result.id).toMatchSnapshot();
      expect(result.ts).toMatchSnapshot();
      expect(result.checksum).toMatchSnapshot();
    });

    test("should use custom name for filename and class name", () => {
      const plan = makePlan([]);
      const result = serializeSqliteMigration(plan, emptySnapshot, {
        name: "add-user-table",
        timestamp: FIXED_DATE,
      });

      expect(result.filename).toMatchSnapshot();
      expect(result.content).toMatchSnapshot();
    });

    test("should sanitize custom name", () => {
      const plan = makePlan([]);
      const result = serializeSqliteMigration(plan, emptySnapshot, {
        name: "Add User!!!  Table",
        timestamp: FIXED_DATE,
      });

      expect(result.filename).toMatchSnapshot();
      expect(result.content).toMatchSnapshot();
    });

    test("should use 'generated' slug when no name is provided", () => {
      const plan = makePlan([]);
      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.filename).toMatchSnapshot();
      expect(result.content).toMatchSnapshot();
    });
  });

  describe("create_table operation", () => {
    test("should generate up and down bodies for create_table", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "users",
          ddl: 'CREATE TABLE "users" (\n  "id" TEXT PRIMARY KEY,\n  "name" TEXT NOT NULL\n);',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should handle multiple create_table operations", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "users",
          ddl: 'CREATE TABLE "users" ("id" TEXT PRIMARY KEY);',
          foreignTableDeps: [],
        },
        {
          type: "create_table",
          tableName: "posts",
          ddl: 'CREATE TABLE "posts" ("id" TEXT PRIMARY KEY, "user_id" TEXT NOT NULL);',
          foreignTableDeps: ["users"],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("add_column operation", () => {
    test("should generate up body for add_column with irreversible down warning", () => {
      const plan = makePlan([
        {
          type: "add_column",
          tableName: "users",
          ddl: 'ALTER TABLE "users" ADD COLUMN "email" TEXT;',
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("create_index operation", () => {
    test("should generate up and down bodies for create_index", () => {
      const plan = makePlan([
        {
          type: "create_index",
          ddl: 'CREATE INDEX "idx_users_email" ON "users" ("email");',
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should generate up and down bodies for unique index", () => {
      const plan = makePlan([
        {
          type: "create_index",
          ddl: 'CREATE UNIQUE INDEX IF NOT EXISTS "idx_users_email_unique" ON "users" ("email");',
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should emit warning when index name cannot be extracted", () => {
      const plan = makePlan([
        {
          type: "create_index",
          ddl: "CREATE INDEX ON users (email);",
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("drop_index operation", () => {
    test("should generate up body for drop_index with irreversible down warning", () => {
      const plan = makePlan([
        {
          type: "drop_index",
          indexName: "idx_users_email",
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("drop_table operation", () => {
    test("should generate up body for drop_table with irreversible down warning", () => {
      const plan = makePlan([
        {
          type: "drop_table",
          tableName: "legacy_data",
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("recreate_table operation", () => {
    test("should generate full recreate_table migration with transaction", () => {
      const plan = makePlan([
        {
          type: "recreate_table",
          tableName: "users",
          newDdl:
            'CREATE TABLE "_new_users" (\n  "id" TEXT PRIMARY KEY,\n  "name" TEXT NOT NULL,\n  "email" TEXT\n);',
          copyColumns: ["id", "name"],
          newIndexesDdl: ['CREATE INDEX "idx_users_name" ON "users" ("name");'],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should handle recreate_table with no indexes", () => {
      const plan = makePlan([
        {
          type: "recreate_table",
          tableName: "posts",
          newDdl: 'CREATE TABLE "_new_posts" ("id" TEXT PRIMARY KEY, "title" TEXT);',
          copyColumns: ["id"],
          newIndexesDdl: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should handle recreate_table with multiple indexes", () => {
      const plan = makePlan([
        {
          type: "recreate_table",
          tableName: "orders",
          newDdl:
            'CREATE TABLE "_new_orders" ("id" TEXT PRIMARY KEY, "user_id" TEXT, "status" TEXT);',
          copyColumns: ["id", "user_id", "status"],
          newIndexesDdl: [
            'CREATE INDEX "idx_orders_user_id" ON "orders" ("user_id");',
            'CREATE INDEX "idx_orders_status" ON "orders" ("status");',
          ],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should fallback to _new_ prefix when temp table name cannot be extracted", () => {
      const plan = makePlan([
        {
          type: "recreate_table",
          tableName: "items",
          newDdl: "CREATE TABLE items_temp (id TEXT PRIMARY KEY);",
          copyColumns: ["id"],
          newIndexesDdl: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("mixed operations", () => {
    test("should handle a plan with multiple operation types", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "categories",
          ddl: 'CREATE TABLE "categories" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL);',
          foreignTableDeps: [],
        },
        {
          type: "add_column",
          tableName: "posts",
          ddl: 'ALTER TABLE "posts" ADD COLUMN "category_id" TEXT;',
        },
        {
          type: "create_index",
          ddl: 'CREATE INDEX "idx_posts_category_id" ON "posts" ("category_id");',
        },
        {
          type: "drop_index",
          indexName: "idx_posts_legacy",
        },
        {
          type: "recreate_table",
          tableName: "users",
          newDdl:
            'CREATE TABLE "_new_users" ("id" TEXT PRIMARY KEY, "name" TEXT NOT NULL, "email" TEXT UNIQUE);',
          copyColumns: ["id", "name"],
          newIndexesDdl: ['CREATE UNIQUE INDEX "idx_users_email" ON "users" ("email");'],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
        name: "big-migration",
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should reverse operations in down body", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "first",
          ddl: 'CREATE TABLE "first" ("id" TEXT PRIMARY KEY);',
          foreignTableDeps: [],
        },
        {
          type: "create_table",
          tableName: "second",
          ddl: 'CREATE TABLE "second" ("id" TEXT PRIMARY KEY);',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("empty plan", () => {
    test("should generate valid migration with empty up and down bodies", () => {
      const plan = makePlan([]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("SQL escaping", () => {
    test("should escape backticks in DDL", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "test",
          ddl: 'CREATE TABLE "test" ("col`name" TEXT);',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should escape dollar signs in DDL", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "test",
          ddl: 'CREATE TABLE "test" ("price" TEXT DEFAULT \'$0.00\');',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });

    test("should escape backslashes in DDL", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "test",
          ddl: 'CREATE TABLE "test" ("path" TEXT DEFAULT \'C:\\data\');',
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });

  describe("whitespace normalization", () => {
    test("should collapse multiline DDL into single-line SQL in up body", () => {
      const plan = makePlan([
        {
          type: "create_table",
          tableName: "items",
          ddl: `CREATE TABLE "items" (
  "id"    TEXT    PRIMARY KEY,
  "name"  TEXT    NOT NULL,
  "count" INTEGER DEFAULT 0
);`,
          foreignTableDeps: [],
        },
      ]);

      const result = serializeSqliteMigration(plan, emptySnapshot, {
        timestamp: FIXED_DATE,
      });

      expect(result.content).toMatchSnapshot();
    });
  });
});
