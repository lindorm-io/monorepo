import { randomBytes } from "crypto";
import { Client } from "pg";
import { createTestPgClient } from "../../../../__fixtures__/create-test-pg-client";
import { diffSchema } from "../../../../drivers/postgres/utils/sync/diff-schema";
import { SyncPlanExecutor } from "../../../../drivers/postgres/utils/sync/execute-sync-plan";
import type { DesiredSchema } from "../../types/desired-schema";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type { SyncOptions, SyncPlan } from "../../types/sync-plan";
import { introspectSchema } from "./introspect-schema";

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
  schema = `test_exec_${randomBytes(6).toString("hex")}`;
});

afterAll(async () => {
  await raw.query(`DROP SCHEMA IF EXISTS ${schema} CASCADE`);
  await raw.end();
});

describe("executeSyncPlan (integration)", () => {
  it("should create schema, enum, table, constraints, indexes, and comments from scratch", async () => {
    const desired: DesiredSchema = {
      extensions: [],
      schemas: [schema],
      enums: [{ schema, name: "enum_role", values: ["admin", "user", "guest"] }],
      tables: [
        {
          schema,
          name: "accounts",
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
            {
              name: "role",
              pgType: `"${schema}"."enum_role"`,
              nullable: false,
              defaultExpr: `'user'::"${schema}"."enum_role"`,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "score",
              pgType: "INTEGER",
              nullable: true,
              defaultExpr: "0",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "created_at",
              pgType: "TIMESTAMPTZ(3)",
              nullable: false,
              defaultExpr: "now()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "accounts_pkey",
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
              name: "uq_accounts_email",
              type: "UNIQUE",
              columns: ["email"],
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
              name: "chk_accounts_score",
              type: "CHECK",
              columns: [],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: "CHECK (score >= 0)",
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [
            {
              name: "idx_accounts_created",
              unique: false,
              columns: [{ name: "created_at", direction: "desc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
          ],
          comment: "User accounts table",
          columnComments: { email: "Primary email" },
          triggers: [],
        },
      ],
    };

    // Snapshot empty DB
    const snapshot = await introspectSchema(client, [{ schema, name: "accounts" }]);

    // Diff and execute
    const plan = diffSchema(snapshot, desired);
    expect(plan.operations.length).toBeGreaterThan(0);

    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);
    expect(result.statementsExecuted).toBe(result.executedSql.length);

    // Verify by introspecting again
    const after = await introspectSchema(client, [{ schema, name: "accounts" }]);

    expect(after.schemas).toContain(schema);
    expect(after.enums).toHaveLength(1);
    expect(after.enums[0].name).toBe("enum_role");
    expect(after.enums[0].values).toEqual(["admin", "user", "guest"]);

    const table = after.tables.find((t) => t.name === "accounts")!;
    expect(table).toBeDefined();
    expect(table.columns.map((c) => c.name)).toEqual([
      "id",
      "email",
      "role",
      "score",
      "created_at",
    ]);

    const pk = table.constraints.find((c) => c.type === "PRIMARY KEY");
    expect(pk).toBeDefined();
    expect(pk!.columns).toEqual(["id"]);

    const uq = table.constraints.find((c) => c.type === "UNIQUE");
    expect(uq).toBeDefined();
    expect(uq!.columns).toEqual(["email"]);

    const chk = table.constraints.find((c) => c.type === "CHECK");
    expect(chk).toBeDefined();

    const idx = table.indexes.find((i) => i.name === "idx_accounts_created");
    expect(idx).toBeDefined();
    expect(idx!.columns[0].direction).toBe("desc");

    expect(table.comment).toBe("User accounts table");
    expect(table.columnComments.email).toBe("Primary email");
  });

  it("should add columns, drop columns, and alter constraints on second sync", async () => {
    // Now evolve the schema — add a column, drop one, add new index
    const desired: DesiredSchema = {
      extensions: [],
      schemas: [schema],
      enums: [
        { schema, name: "enum_role", values: ["admin", "user", "guest", "moderator"] },
      ],
      tables: [
        {
          schema,
          name: "accounts",
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
            {
              name: "role",
              pgType: `"${schema}"."enum_role"`,
              nullable: false,
              defaultExpr: `'user'::"${schema}"."enum_role"`,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            // score dropped
            {
              name: "display_name",
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
              name: "created_at",
              pgType: "TIMESTAMPTZ(3)",
              nullable: false,
              defaultExpr: "now()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "accounts_pkey",
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
              name: "uq_accounts_email",
              type: "UNIQUE",
              columns: ["email"],
              foreignSchema: null,
              foreignTable: null,
              foreignColumns: null,
              onDelete: null,
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
            // chk_accounts_score dropped (score column gone)
          ],
          indexes: [
            {
              name: "idx_accounts_created",
              unique: false,
              columns: [{ name: "created_at", direction: "desc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
            {
              name: "idx_accounts_display_name",
              unique: false,
              columns: [{ name: "display_name", direction: "asc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
          ],
          comment: "User accounts table",
          columnComments: { email: "Primary email" },
          triggers: [],
        },
      ],
    };

    const snapshot = await introspectSchema(client, [{ schema, name: "accounts" }]);
    const plan = diffSchema(snapshot, desired);
    expect(plan.operations.length).toBeGreaterThan(0);

    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);

    // Verify
    const after = await introspectSchema(client, [{ schema, name: "accounts" }]);
    const table = after.tables.find((t) => t.name === "accounts")!;

    // score column should be gone, display_name should be there
    const colNames = table.columns.map((c) => c.name);
    expect(colNames).not.toContain("score");
    expect(colNames).toContain("display_name");

    // chk_accounts_score constraint should be gone
    expect(
      table.constraints.find((c) => c.name === "chk_accounts_score"),
    ).toBeUndefined();

    // New index should exist
    expect(
      table.indexes.find((i) => i.name === "idx_accounts_display_name"),
    ).toBeDefined();

    // Enum should have new value
    const enumType = after.enums.find((e) => e.name === "enum_role")!;
    expect(enumType.values).toContain("moderator");
  });

  it("should be idempotent — re-running same desired produces no operations", async () => {
    const desired: DesiredSchema = {
      extensions: [],
      schemas: [schema],
      enums: [
        { schema, name: "enum_role", values: ["admin", "user", "guest", "moderator"] },
      ],
      tables: [
        {
          schema,
          name: "accounts",
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
            {
              name: "role",
              pgType: `"${schema}"."enum_role"`,
              nullable: false,
              defaultExpr: `'user'::"${schema}"."enum_role"`,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "display_name",
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
              name: "created_at",
              pgType: "TIMESTAMPTZ(3)",
              nullable: false,
              defaultExpr: "now()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "accounts_pkey",
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
              name: "uq_accounts_email",
              type: "UNIQUE",
              columns: ["email"],
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
              name: "idx_accounts_created",
              unique: false,
              columns: [{ name: "created_at", direction: "desc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
            {
              name: "idx_accounts_display_name",
              unique: false,
              columns: [{ name: "display_name", direction: "asc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
          ],
          comment: "User accounts table",
          columnComments: { email: "Primary email" },
          triggers: [],
        },
      ],
    };

    const snapshot = await introspectSchema(client, [{ schema, name: "accounts" }]);
    const plan = diffSchema(snapshot, desired);

    // Should be zero operations — everything already matches
    expect(plan.operations).toHaveLength(0);
    expect(plan.summary.total).toBe(0);
  });

  it("should return dry-run result without modifying database", async () => {
    const desired: DesiredSchema = {
      extensions: [],
      schemas: [schema],
      enums: [],
      tables: [
        {
          schema,
          name: "accounts",
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
            // Only id — everything else "removed"
          ],
          constraints: [
            {
              name: "accounts_pkey",
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

    const snapshotBefore = await introspectSchema(client, [{ schema, name: "accounts" }]);
    const plan = diffSchema(snapshotBefore, desired);
    expect(plan.operations.length).toBeGreaterThan(0);

    // Dry run
    const result = await executeSyncPlan(client, plan, { dryRun: true });
    expect(result.executed).toBe(false);
    expect(result.statementsExecuted).toBe(0);

    // Verify DB unchanged
    const snapshotAfter = await introspectSchema(client, [{ schema, name: "accounts" }]);
    expect(snapshotAfter.tables[0].columns.length).toBe(
      snapshotBefore.tables[0].columns.length,
    );
  });

  it("should create new table with FK referencing existing table", async () => {
    const desired: DesiredSchema = {
      extensions: [],
      schemas: [schema],
      enums: [
        { schema, name: "enum_role", values: ["admin", "user", "guest", "moderator"] },
      ],
      tables: [
        // Keep existing accounts table
        {
          schema,
          name: "accounts",
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
            {
              name: "role",
              pgType: `"${schema}"."enum_role"`,
              nullable: false,
              defaultExpr: `'user'::"${schema}"."enum_role"`,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "display_name",
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
              name: "created_at",
              pgType: "TIMESTAMPTZ(3)",
              nullable: false,
              defaultExpr: "now()",
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
          ],
          constraints: [
            {
              name: "accounts_pkey",
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
              name: "uq_accounts_email",
              type: "UNIQUE",
              columns: ["email"],
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
              name: "idx_accounts_created",
              unique: false,
              columns: [{ name: "created_at", direction: "desc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
            {
              name: "idx_accounts_display_name",
              unique: false,
              columns: [{ name: "display_name", direction: "asc" }],
              method: "btree",
              where: null,
              include: null,
              concurrent: false,
            },
          ],
          comment: "User accounts table",
          columnComments: { email: "Primary email" },
          triggers: [],
        },
        // New table with FK
        {
          schema,
          name: "sessions",
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
              name: "account_id",
              pgType: "UUID",
              nullable: false,
              defaultExpr: null,
              isIdentity: false,
              identityGeneration: null,
              isGenerated: false,
              generationExpr: null,
              collation: null,
            },
            {
              name: "token",
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
              name: "expires_at",
              pgType: "TIMESTAMPTZ(3)",
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
              name: "sessions_pkey",
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
              name: "fk_sessions_account",
              type: "FOREIGN KEY",
              columns: ["account_id"],
              foreignSchema: schema,
              foreignTable: "accounts",
              foreignColumns: ["id"],
              onDelete: "CASCADE",
              onUpdate: null,
              checkExpr: null,
              deferrable: false,
              initiallyDeferred: false,
            },
          ],
          indexes: [
            {
              name: "idx_sessions_account",
              unique: false,
              columns: [{ name: "account_id", direction: "asc" }],
              method: "btree",
              where: null,
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

    const snapshot = await introspectSchema(client, [
      { schema, name: "accounts" },
      { schema, name: "sessions" },
    ]);
    const plan = diffSchema(snapshot, desired);

    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);

    // Verify sessions table created with FK
    const after = await introspectSchema(client, [
      { schema, name: "accounts" },
      { schema, name: "sessions" },
    ]);

    const sessions = after.tables.find((t) => t.name === "sessions")!;
    expect(sessions).toBeDefined();
    expect(sessions.columns.map((c) => c.name)).toEqual([
      "id",
      "account_id",
      "token",
      "expires_at",
    ]);

    const fk = sessions.constraints.find((c) => c.type === "FOREIGN KEY");
    expect(fk).toBeDefined();
    expect(fk!.columns).toEqual(["account_id"]);
    expect(fk!.foreignTable).toBe("accounts");
    expect(fk!.onDelete).toBe("CASCADE");
  });

  it("should handle autocommit operations (ADD ENUM VALUE)", async () => {
    // Test autocommit phase directly — construct a plan with an autocommit op
    const plan = {
      operations: [
        {
          type: "add_enum_value" as const,
          severity: "safe" as const,
          schema,
          table: null,
          description: `Add value "superadmin" to ${schema}.enum_role`,
          sql: `ALTER TYPE "${schema}"."enum_role" ADD VALUE IF NOT EXISTS 'superadmin';`,
          autocommit: true,
        },
      ],
      summary: { safe: 1, warning: 0, destructive: 0, total: 1 },
    };

    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);
    expect(result.statementsExecuted).toBe(1);

    // Verify the enum has the new value
    const after = await introspectSchema(client, [{ schema, name: "accounts" }]);
    const enumType = after.enums.find((e) => e.name === "enum_role")!;
    expect(enumType.values).toContain("superadmin");
  });
});
