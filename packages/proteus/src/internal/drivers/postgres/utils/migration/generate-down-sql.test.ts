import type { DbSnapshot } from "../../types/db-snapshot";
import type { SyncOperation } from "../../types/sync-plan";
import { generateDownSql } from "./generate-down-sql";
import { describe, expect, it } from "vitest";

const emptySnapshot: DbSnapshot = { tables: [], enums: [], schemas: [] };

const snapshotWithTable = (overrides?: Partial<DbSnapshot["tables"][0]>): DbSnapshot => ({
  tables: [
    {
      schema: "app",
      name: "users",
      columns: [
        {
          name: "id",
          type: "UUID",
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
          type: "TEXT",
          nullable: false,
          defaultExpr: "''",
          isIdentity: false,
          identityGeneration: null,
          isGenerated: false,
          generationExpr: null,
          collation: null,
        },
        {
          name: "age",
          type: "INTEGER",
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
          name: "users_pkey",
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
          name: "uq_email",
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
          name: "chk_age",
          type: "CHECK",
          columns: ["age"],
          foreignSchema: null,
          foreignTable: null,
          foreignColumns: null,
          onDelete: null,
          onUpdate: null,
          checkExpr: "CHECK ((age >= 0))",
          deferrable: false,
          initiallyDeferred: false,
        },
        {
          name: "fk_org",
          type: "FOREIGN KEY",
          columns: ["org_id"],
          foreignSchema: "app",
          foreignTable: "orgs",
          foreignColumns: ["id"],
          onDelete: "CASCADE",
          onUpdate: "NO ACTION",
          checkExpr: null,
          deferrable: false,
          initiallyDeferred: false,
        },
      ],
      indexes: [
        {
          name: "idx_email",
          unique: false,
          columns: [{ name: "email", direction: "asc" }],
          method: "btree",
          where: null,
          include: [],
        },
        {
          name: "idx_active",
          unique: false,
          columns: [{ name: "status", direction: "asc" }],
          method: "btree",
          where: "status = 'active'",
          include: ["email"],
        },
      ],
      comment: "The users table",
      columnComments: { email: "User email address" },
      triggers: [],
      ...overrides,
    },
  ],
  enums: [],
  schemas: ["app"],
});

const op = (overrides: Partial<SyncOperation>): SyncOperation => ({
  type: "add_column",
  severity: "safe",
  schema: "app",
  table: "users",
  description: "",
  sql: "",
  autocommit: false,
  ...overrides,
});

// --- Irreversible operations ---

describe("generateDownSql — irreversible", () => {
  it.each([
    "create_extension",
    "create_schema",
    "create_enum",
    "add_enum_value",
    "create_table",
    "drop_column",
    "alter_column_type",
    "alter_column_identity",
    "backfill_column",
    "warn_only",
  ] as const)("should return null for %s", (type) => {
    expect(
      generateDownSql(op({ type, description: `Something "${type}"` }), emptySnapshot),
    ).toBeNull();
  });
});

// --- add_column ---

describe("generateDownSql — add_column", () => {
  it("should produce DROP COLUMN", () => {
    const result = generateDownSql(
      op({
        type: "add_column",
        description: 'Add column "email" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "email" TEXT NOT NULL DEFAULT \'\';',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });
});

// --- alter_column_nullable ---

describe("generateDownSql — alter_column_nullable", () => {
  it("should reverse DROP NOT NULL to SET NOT NULL", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_nullable",
        description: 'Allow NULL on "age" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "age" DROP NOT NULL;',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });

  it("should reverse SET NOT NULL to DROP NOT NULL", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_nullable",
        description: 'Set NOT NULL on "age" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "age" SET NOT NULL;',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });
});

// --- alter_column_default ---

describe("generateDownSql — alter_column_default", () => {
  it("should restore prior default when setting a new one", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_default",
        description: 'Set default on "email" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "email" SET DEFAULT \'new\';',
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should drop default when prior had none", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_default",
        description: 'Set default on "age" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "age" SET DEFAULT 0;',
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should restore prior default when dropping", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_default",
        description: 'Drop default from "email" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "email" DROP DEFAULT;',
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null for temporary default drops", () => {
    const result = generateDownSql(
      op({
        type: "alter_column_default",
        description: 'Drop temporary default from "email" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "email" DROP DEFAULT;',
      }),
      snapshotWithTable(),
    );
    expect(result).toBeNull();
  });
});

// --- drop_and_readd_column ---

describe("generateDownSql — drop_and_readd_column", () => {
  it("should return null for drop phase", () => {
    const result = generateDownSql(
      op({
        type: "drop_and_readd_column",
        description:
          'Drop computed column "calc" on "app"."users" (type/expression changed)',
        sql: 'ALTER TABLE "app"."users" DROP COLUMN "calc";',
      }),
      emptySnapshot,
    );
    expect(result).toBeNull();
  });

  it("should produce DROP COLUMN for re-add phase", () => {
    const result = generateDownSql(
      op({
        type: "drop_and_readd_column",
        description: 'Re-add computed column "calc" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "calc" INTEGER GENERATED ALWAYS AS (a + b) STORED;',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null for incompatible-type drop phase", () => {
    const result = generateDownSql(
      op({
        type: "drop_and_readd_column",
        description:
          'Drop column "geo" on "app"."users" (incompatible type change TEXT → POINT)',
        sql: 'ALTER TABLE "app"."users" DROP COLUMN "geo";',
      }),
      emptySnapshot,
    );
    expect(result).toBeNull();
  });

  it("should produce DROP COLUMN for incompatible-type re-add phase", () => {
    const result = generateDownSql(
      op({
        type: "drop_and_readd_column",
        description: 'Re-add column "geo" on "app"."users" as POINT',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "geo" POINT;',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });
});

// --- add_constraint ---

describe("generateDownSql — add_constraint", () => {
  it("should produce DROP CONSTRAINT", () => {
    const result = generateDownSql(
      op({
        type: "add_constraint",
        description: 'Add UNIQUE "uq_email" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD CONSTRAINT "uq_email" UNIQUE ("email");',
        constraintType: "UNIQUE",
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });
});

// --- drop_constraint ---

describe("generateDownSql — drop_constraint", () => {
  it("should reconstruct PRIMARY KEY from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop PRIMARY KEY constraint "users_pkey" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "users_pkey";',
        constraintType: "PRIMARY KEY",
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should reconstruct UNIQUE from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop UNIQUE constraint "uq_email" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "uq_email";',
        constraintType: "UNIQUE",
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should reconstruct CHECK from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop CHECK constraint "chk_age" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "chk_age";',
        constraintType: "CHECK",
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should reconstruct FOREIGN KEY from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop FOREIGN KEY constraint "fk_org" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "fk_org";',
        constraintType: "FOREIGN KEY",
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null for CHECK with missing checkExpr", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop CHECK constraint "chk_broken" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "chk_broken";',
        constraintType: "CHECK",
      }),
      snapshotWithTable({
        constraints: [
          {
            name: "chk_broken",
            type: "CHECK",
            columns: ["age"],
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
      }),
    );
    expect(result).toBeNull();
  });

  it("should reconstruct FOREIGN KEY with DEFERRABLE INITIALLY DEFERRED from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop FOREIGN KEY constraint "fk_org_deferred" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "fk_org_deferred";',
        constraintType: "FOREIGN KEY",
      }),
      snapshotWithTable({
        constraints: [
          {
            name: "fk_org_deferred",
            type: "FOREIGN KEY",
            columns: ["org_id"],
            foreignSchema: "app",
            foreignTable: "orgs",
            foreignColumns: ["id"],
            onDelete: "CASCADE",
            onUpdate: "NO ACTION",
            checkExpr: null,
            deferrable: true,
            initiallyDeferred: true,
          },
        ],
      }),
    );
    expect(result).toMatchSnapshot();
  });

  it("should reconstruct FOREIGN KEY with DEFERRABLE INITIALLY IMMEDIATE from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop FOREIGN KEY constraint "fk_org_immediate" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "fk_org_immediate";',
        constraintType: "FOREIGN KEY",
      }),
      snapshotWithTable({
        constraints: [
          {
            name: "fk_org_immediate",
            type: "FOREIGN KEY",
            columns: ["org_id"],
            foreignSchema: "app",
            foreignTable: "orgs",
            foreignColumns: ["id"],
            onDelete: "CASCADE",
            onUpdate: "NO ACTION",
            checkExpr: null,
            deferrable: true,
            initiallyDeferred: false,
          },
        ],
      }),
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null when constraint not in snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_constraint",
        description: 'Drop UNIQUE constraint "gone" from "app"."users"',
        sql: 'ALTER TABLE "app"."users" DROP CONSTRAINT "gone";',
      }),
      snapshotWithTable(),
    );
    expect(result).toBeNull();
  });
});

// --- create_index ---

describe("generateDownSql — create_index", () => {
  it("should produce DROP INDEX", () => {
    const result = generateDownSql(
      op({
        type: "create_index",
        description: 'Create index "idx_email" on "app"."users"',
        sql: 'CREATE INDEX "idx_email" ON "app"."users" ("email" ASC);',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });
});

// --- drop_index ---

describe("generateDownSql — drop_index", () => {
  it("should reconstruct simple index from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_index",
        description: 'Drop index "idx_email" from "app"."users"',
        sql: 'DROP INDEX IF EXISTS "app"."idx_email";',
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should reconstruct index with WHERE and INCLUDE from snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_index",
        description: 'Drop index "idx_active" from "app"."users"',
        sql: 'DROP INDEX IF EXISTS "app"."idx_active";',
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null when index not in snapshot", () => {
    const result = generateDownSql(
      op({
        type: "drop_index",
        description: 'Drop index "gone" from "app"."users"',
        sql: 'DROP INDEX IF EXISTS "app"."gone";',
      }),
      snapshotWithTable(),
    );
    expect(result).toBeNull();
  });
});

// --- set_comment ---

describe("generateDownSql — set_comment", () => {
  it("should restore prior table comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on table "app"."users"',
        sql: `COMMENT ON TABLE "app"."users" IS 'New comment';`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should set NULL when no prior table comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on table "app"."users"',
        sql: `COMMENT ON TABLE "app"."users" IS 'First comment';`,
      }),
      snapshotWithTable({ comment: null }),
    );
    expect(result).toMatchSnapshot();
  });

  it("should restore prior column comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on column "app"."users"."email"',
        sql: `COMMENT ON COLUMN "app"."users"."email" IS 'New col comment';`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should set NULL when no prior column comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on column "app"."users"."age"',
        sql: `COMMENT ON COLUMN "app"."users"."age" IS 'First col comment';`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should restore prior comment when removing", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Remove comment from table "app"."users"',
        sql: `COMMENT ON TABLE "app"."users" IS NULL;`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should restore prior column comment when removing", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Remove comment from column "app"."users"."email"',
        sql: `COMMENT ON COLUMN "app"."users"."email" IS NULL;`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should set NULL when removing column comment with no prior", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Remove comment from column "app"."users"."age"',
        sql: `COMMENT ON COLUMN "app"."users"."age" IS NULL;`,
      }),
      snapshotWithTable(),
    );
    expect(result).toMatchSnapshot();
  });

  it("should escape single quotes in prior table comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on table "app"."users"',
        sql: `COMMENT ON TABLE "app"."users" IS 'New comment';`,
      }),
      snapshotWithTable({ comment: "It's the user's table" }),
    );
    expect(result).toMatchSnapshot();
  });

  it("should escape single quotes in prior column comment", () => {
    const result = generateDownSql(
      op({
        type: "set_comment",
        description: 'Set comment on column "app"."users"."email"',
        sql: `COMMENT ON COLUMN "app"."users"."email" IS 'New col comment';`,
      }),
      snapshotWithTable({ columnComments: { email: "User's email address" } }),
    );
    expect(result).toMatchSnapshot();
  });
});

// --- create_trigger ---

describe("generateDownSql — create_trigger", () => {
  it("should produce DROP TRIGGER for CREATE TRIGGER sql", () => {
    const result = generateDownSql(
      op({
        type: "create_trigger",
        description: 'Create trigger "trg_append_only_users" on "app"."users"',
        sql: 'CREATE TRIGGER "trg_append_only_users" BEFORE UPDATE OR DELETE ON "app"."users" FOR EACH ROW EXECUTE FUNCTION proteus_append_only();',
      }),
      emptySnapshot,
    );
    expect(result).toMatchSnapshot();
  });

  it("should return null for CREATE OR REPLACE FUNCTION sql", () => {
    const result = generateDownSql(
      op({
        type: "create_trigger",
        description: 'Create trigger "trg_append_only_users" on "app"."users"',
        sql: `CREATE OR REPLACE FUNCTION proteus_append_only() RETURNS TRIGGER AS $$ BEGIN RAISE EXCEPTION 'append-only: updates not allowed'; END; $$ LANGUAGE plpgsql;`,
      }),
      emptySnapshot,
    );
    expect(result).toBeNull();
  });
});

// --- drop_trigger ---

describe("generateDownSql — drop_trigger", () => {
  it("should return null (irreversible)", () => {
    const result = generateDownSql(
      op({
        type: "drop_trigger",
        description: 'Drop trigger "trg_append_only_users" on "app"."users"',
        sql: 'DROP TRIGGER IF EXISTS "trg_append_only_users" ON "app"."users";',
      }),
      emptySnapshot,
    );
    expect(result).toBeNull();
  });
});
