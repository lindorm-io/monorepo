import { randomBytes } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import type { DesiredSchema } from "../../types/desired-schema";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { diffSchema } from "./diff-schema";
import { SyncPlanExecutor } from "./execute-sync-plan";
import { introspectSchema } from "./introspect-schema";
import type { SyncPlan, SyncOptions } from "../../types/sync-plan";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const executeSyncPlan = (
  client: PostgresQueryClient,
  plan: SyncPlan,
  options: SyncOptions = {},
) => new SyncPlanExecutor(undefined, schema).execute(client, plan, options);

let client: PostgresQueryClient;
let raw: Client;
let schema: string;

beforeAll(async () => {
  ({ client, raw } = await createTestPgClient());
  schema = `test_evo_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await raw.end();
});

// Helper to sync a desired schema and return the introspected result
const syncAndIntrospect = async (desired: DesiredSchema, tableNames: Array<string>) => {
  const managed = tableNames.map((name) => ({ schema, name }));
  const snapshot = await introspectSchema(client, managed);
  const plan = diffSchema(snapshot, desired);
  if (plan.operations.length > 0) {
    await executeSyncPlan(client, plan);
  }
  return introspectSchema(client, managed);
};

describe("schema evolution (integration)", () => {
  // ── Gap 4: Column Evolution ──

  describe("column type change with USING cast", () => {
    const TABLE = "type_cast_test";

    it("should create initial table with TEXT column", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "code",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: "'0'",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const table = after.tables.find((t) => t.name === TABLE)!;
      expect(table.columns.find((c) => c.name === "code")!.type).toBe("text");

      // Insert data for cast test
      await raw.query(`INSERT INTO "${schema}"."${TABLE}" (code) VALUES ('42'), ('99')`);
    });

    it("should alter TEXT → INTEGER using USING cast", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "code",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: "0",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const col = after.tables
        .find((t) => t.name === TABLE)!
        .columns.find((c) => c.name === "code")!;
      expect(col.type).toBe("integer");

      // Verify data survived the cast
      const data = await raw.query(
        `SELECT code FROM "${schema}"."${TABLE}" ORDER BY code`,
      );
      expect(data.rows.map((r: any) => r.code)).toEqual([42, 99]);
    });
  });

  describe("nullable → NOT NULL with backfill", () => {
    const TABLE = "backfill_test";

    it("should create table with nullable column and insert NULLs", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "label",
                pgType: "TEXT",
                nullable: true,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "count",
                pgType: "INTEGER",
                nullable: true,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      await syncAndIntrospect(desired, [TABLE]);
      await raw.query(
        `INSERT INTO "${schema}"."${TABLE}" (label, count) VALUES (NULL, NULL), ('hello', NULL), (NULL, 5)`,
      );
    });

    it("should backfill NULLs and set NOT NULL", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "label",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "count",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const table = after.tables.find((t) => t.name === TABLE)!;
      expect(table.columns.find((c) => c.name === "label")!.nullable).toBe(false);
      expect(table.columns.find((c) => c.name === "count")!.nullable).toBe(false);

      // Verify NULLs were backfilled with zero-values
      const data = await raw.query(
        `SELECT label, count FROM "${schema}"."${TABLE}" ORDER BY count, label`,
      );
      expect(data.rows).toEqual([
        { label: "", count: 0 },
        { label: "hello", count: 0 },
        { label: "", count: 5 },
      ]);
    });
  });

  describe("identity column add/drop", () => {
    const TABLE = "identity_test";

    it("should create table with plain INTEGER column", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "name",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const col = after.tables
        .find((t) => t.name === TABLE)!
        .columns.find((c) => c.name === "id")!;
      expect(col.isIdentity).toBe(false);
    });

    it("should add identity to existing column", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: null,
                isIdentity: true,
                identityGeneration: "ALWAYS",
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "name",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const col = after.tables
        .find((t) => t.name === TABLE)!
        .columns.find((c) => c.name === "id")!;
      expect(col.isIdentity).toBe(true);
      expect(col.identityGeneration).toBe("ALWAYS");
    });

    it("should drop identity from column", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "name",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [TABLE]);
      const col = after.tables
        .find((t) => t.name === TABLE)!
        .columns.find((c) => c.name === "id")!;
      expect(col.isIdentity).toBe(false);
    });
  });

  // ── Gap 5: Constraint/Index Mutation ──

  describe("FK policy change (drop + re-add)", () => {
    const PARENT = "fk_parent";
    const CHILD = "fk_child";

    it("should create tables with FK NO ACTION", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: PARENT,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${PARENT}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
          {
            schema,
            name: CHILD,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "parent_id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${CHILD}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
              {
                name: "fk_child_parent",
                type: "FOREIGN KEY",
                columns: ["parent_id"],
                foreignSchema: schema,
                foreignTable: PARENT,
                foreignColumns: ["id"],
                onDelete: "NO ACTION",
                onUpdate: "NO ACTION",
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [PARENT, CHILD]);
      const fk = after.tables
        .find((t) => t.name === CHILD)!
        .constraints.find((c) => c.name === "fk_child_parent")!;
      expect(fk.onDelete).toBe("NO ACTION");

      // Insert data so FK is exercised
      await raw.query(
        `INSERT INTO "${schema}"."${PARENT}" (id) VALUES ('11111111-1111-1111-1111-111111111111')`,
      );
      await raw.query(
        `INSERT INTO "${schema}"."${CHILD}" (parent_id) VALUES ('11111111-1111-1111-1111-111111111111')`,
      );
    });

    it("should change FK onDelete to CASCADE", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: PARENT,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${PARENT}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
          {
            schema,
            name: CHILD,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "parent_id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${CHILD}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
              {
                name: "fk_child_parent",
                type: "FOREIGN KEY",
                columns: ["parent_id"],
                foreignSchema: schema,
                foreignTable: PARENT,
                foreignColumns: ["id"],
                onDelete: "CASCADE",
                onUpdate: "NO ACTION",
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const after = await syncAndIntrospect(desired, [PARENT, CHILD]);
      const fk = after.tables
        .find((t) => t.name === CHILD)!
        .constraints.find((c) => c.name === "fk_child_parent")!;
      expect(fk.onDelete).toBe("CASCADE");
    });
  });

  describe("partial index round-trip stability", () => {
    const TABLE = "partial_idx_test";

    it("should create table with partial index", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "status",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: "'active'",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "email",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [
              {
                name: "idx_partial_active",
                unique: false,
                columns: [{ name: "email", direction: "asc" }],
                method: "btree",
                where: "status = 'active'",
                include: null,
                concurrent: false,
              },
            ],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      await syncAndIntrospect(desired, [TABLE]);
    });

    it("should produce zero operations on re-sync (predicate round-trip)", async () => {
      const desired: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "status",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: "'active'",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "email",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [
              {
                name: "idx_partial_active",
                unique: false,
                columns: [{ name: "email", direction: "asc" }],
                method: "btree",
                where: "status = 'active'",
                include: null,
                concurrent: false,
              },
            ],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      const managed = [{ schema, name: TABLE }];
      const snapshot = await introspectSchema(client, managed);
      const plan = diffSchema(snapshot, desired);

      const spurious = plan.operations.map((op) => `[${op.type}] ${op.description}`);
      expect(spurious).toEqual([]);
    });
  });

  describe("CREATE INDEX CONCURRENTLY", () => {
    const TABLE = "concurrent_idx_test";

    it("should create table then add concurrent index", async () => {
      // Step 1: create table
      const desired1: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "email",
                pgType: "TEXT",
                nullable: false,
                defaultExpr: null,
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      await syncAndIntrospect(desired1, [TABLE]);

      // Step 2: add concurrent index
      const desired2: DesiredSchema = {
        ...desired1,
        tables: [
          {
            ...desired1.tables[0],
            indexes: [
              {
                name: "idx_conc_email",
                unique: false,
                columns: [{ name: "email", direction: "asc" }],
                method: "btree",
                where: null,
                include: null,
                concurrent: true,
              },
            ],
          },
        ],
      };

      const after = await syncAndIntrospect(desired2, [TABLE]);
      const idx = after.tables
        .find((t) => t.name === TABLE)!
        .indexes.find((i) => i.name === "idx_conc_email");
      expect(idx).toBeDefined();
      expect(idx!.columns).toEqual([{ name: "email", direction: "asc" }]);
    });
  });

  describe("default expression change", () => {
    const TABLE = "default_change_test";

    it("should create table with default and change it", async () => {
      const desired1: DesiredSchema = {
        extensions: [],
        schemas: [schema],
        enums: [],
        tables: [
          {
            schema,
            name: TABLE,
            columns: [
              {
                name: "id",
                pgType: "UUID",
                nullable: false,
                defaultExpr: "gen_random_uuid()",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
              {
                name: "score",
                pgType: "INTEGER",
                nullable: false,
                defaultExpr: "0",
                isIdentity: false,
                identityGeneration: null,
                isGenerated: false,
                generationExpr: null,
                collation: null,
              },
            ],
            constraints: [
              {
                name: `${TABLE}_pkey`,
                type: "PRIMARY KEY",
                columns: ["id"],
                foreignSchema: null,
                foreignTable: null,
                foreignColumns: null,
                onDelete: null,
                onUpdate: null,
                checkExpr: null,
                deferrable: false,
                initiallyDeferred: false,
              },
            ],
            indexes: [],
            comment: null,
            columnComments: {},
            triggers: [],
          },
        ],
      };

      await syncAndIntrospect(desired1, [TABLE]);

      // Change default from 0 to 100
      const desired2: DesiredSchema = {
        ...desired1,
        tables: [
          {
            ...desired1.tables[0],
            columns: [
              desired1.tables[0].columns[0],
              { ...desired1.tables[0].columns[1], defaultExpr: "100" },
            ],
          },
        ],
      };

      const after = await syncAndIntrospect(desired2, [TABLE]);
      const col = after.tables
        .find((t) => t.name === TABLE)!
        .columns.find((c) => c.name === "score")!;
      expect(col.defaultExpr).toBe("100");
    });
  });
});
