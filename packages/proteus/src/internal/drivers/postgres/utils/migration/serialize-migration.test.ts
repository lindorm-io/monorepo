import { randomUUID } from "crypto";
import type { DbSnapshot } from "../../types/db-snapshot";
import type { SyncOperation, SyncPlan } from "../../types/sync-plan";
import { serializeMigration } from "./serialize-migration";

jest.mock("crypto", () => ({
  ...jest.requireActual("crypto"),
  randomUUID: jest.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

const fixedDate = new Date("2026-02-20T09:00:00.000Z");

const emptySnapshot: DbSnapshot = { tables: [], enums: [], schemas: [] };

const snapshotWithTable: DbSnapshot = {
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
      ],
      constraints: [],
      indexes: [],
      comment: null,
      columnComments: {},
      triggers: [],
    },
  ],
  enums: [],
  schemas: ["app"],
};

const makeOp = (overrides: Partial<SyncOperation>): SyncOperation => ({
  type: "add_column",
  severity: "safe",
  schema: "app",
  table: "users",
  description: "",
  sql: "",
  autocommit: false,
  ...overrides,
});

const makePlan = (operations: Array<SyncOperation>): SyncPlan => {
  const safe = operations.filter((o) => o.severity === "safe").length;
  const warning = operations.filter((o) => o.severity === "warning").length;
  const destructive = operations.filter((o) => o.severity === "destructive").length;
  return {
    operations,
    summary: { safe, warning, destructive, total: operations.length },
  };
};

beforeEach(() => {
  (randomUUID as jest.Mock).mockReturnValue("00000000-0000-0000-0000-000000000001");
});

// --- Filename and class name ---

describe("serializeMigration — naming", () => {
  it("should use Generated{timestamp} class name when no name provided", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.filename).toBe("20260220090000-generated.ts");
    expect(result.content).toContain("export class Generated20260220090000");
  });

  it("should use PascalCase class name from kebab-case name", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
      name: "add-email-to-users",
    });
    expect(result.filename).toBe("20260220090000-add-email-to-users.ts");
    expect(result.content).toContain("export class AddEmailToUsers");
  });

  it("should sanitize non-kebab name input", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
      name: "add_email to.users/v2",
    });
    expect(result.filename).toBe("20260220090000-add-email-to-users-v2.ts");
    expect(result.content).toContain("export class AddEmailToUsersV2");
  });

  it("should embed id and ts in the class body", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.id).toBe("00000000-0000-0000-0000-000000000001");
    expect(result.ts).toBe("2026-02-20T09:00:00.000Z");
    expect(result.content).toContain(
      'public readonly id = "00000000-0000-0000-0000-000000000001"',
    );
    expect(result.content).toContain('public readonly ts = "2026-02-20T09:00:00.000Z"');
  });
});

// --- Empty plan ---

describe("serializeMigration — empty plan", () => {
  it("should produce valid empty migration", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.content).toMatchSnapshot();
    expect(result.checksum).toMatchSnapshot();
  });
});

// --- Transactional only ---

describe("serializeMigration — transactional operations", () => {
  it("should wrap tx ops in runner.transaction for up and down", () => {
    const plan = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "email" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "email" TEXT NOT NULL;',
      }),
      makeOp({
        type: "add_column",
        description: 'Add column "name" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "name" TEXT;',
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toMatchSnapshot();
  });
});

// --- Autocommit only ---

describe("serializeMigration — autocommit operations", () => {
  it("should use runner.query for autocommit ops with description comments", () => {
    const plan = makePlan([
      makeOp({
        type: "add_enum_value",
        severity: "safe",
        schema: "app",
        table: null,
        description: 'Add value \'moderator\' to enum "app"."enum_role"',
        sql: `ALTER TYPE "app"."enum_role" ADD VALUE IF NOT EXISTS 'moderator';`,
        autocommit: true,
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toMatchSnapshot();
  });
});

// --- Mixed tx + autocommit ---

describe("serializeMigration — mixed operations", () => {
  it("should separate tx and autocommit in up, reverse in down", () => {
    const plan = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "role" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "role" TEXT NOT NULL DEFAULT \'user\';',
      }),
      makeOp({
        type: "alter_column_default",
        description: 'Drop temporary default from "role" on "app"."users"',
        sql: 'ALTER TABLE "app"."users" ALTER COLUMN "role" DROP DEFAULT;',
      }),
      makeOp({
        type: "add_enum_value",
        severity: "safe",
        schema: "app",
        table: null,
        description: 'Add value \'admin\' to enum "app"."enum_role"',
        sql: `ALTER TYPE "app"."enum_role" ADD VALUE IF NOT EXISTS 'admin';`,
        autocommit: true,
      }),
    ]);
    const result = serializeMigration(plan, snapshotWithTable, {
      timestamp: fixedDate,
      name: "add-role-column",
    });
    expect(result.content).toMatchSnapshot();
  });
});

// --- Irreversible operations ---

describe("serializeMigration — irreversible ops", () => {
  it("should emit warning comments for irreversible down operations", () => {
    const plan = makePlan([
      makeOp({
        type: "create_table",
        description: 'Create table "app"."users"',
        sql: 'CREATE TABLE "app"."users" ("id" UUID NOT NULL);',
      }),
      makeOp({
        type: "add_column",
        description: 'Add column "email" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "email" TEXT;',
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toMatchSnapshot();
  });

  it("should note when all tx ops are irreversible", () => {
    const plan = makePlan([
      makeOp({
        type: "create_table",
        description: 'Create table "app"."users"',
        sql: 'CREATE TABLE "app"."users" ("id" UUID NOT NULL);',
      }),
      makeOp({
        type: "create_table",
        description: 'Create table "app"."orgs"',
        sql: 'CREATE TABLE "app"."orgs" ("id" UUID NOT NULL);',
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toMatchSnapshot();
  });
});

// --- warn_only filtering ---

describe("serializeMigration — warn_only", () => {
  it("should exclude warn_only operations from migration", () => {
    const plan = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "email" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "email" TEXT;',
      }),
      makeOp({
        type: "warn_only",
        severity: "warning",
        description: "Stale enum value 'old' in app.enum_status",
        sql: "",
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).not.toContain("warn_only");
    expect(result.content).not.toContain("Stale enum value");
    expect(result.content).toContain("ADD COLUMN");
  });
});

// --- SQL normalization ---

describe("serializeMigration — SQL normalization", () => {
  it("should collapse multi-line SQL to single line", () => {
    const plan = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "bio" to "app"."users"',
        sql: 'ALTER TABLE "app"."users"\n  ADD COLUMN "bio"\n    TEXT;',
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toContain('ALTER TABLE "app"."users" ADD COLUMN "bio" TEXT;');
    expect(result.content).not.toContain("\n  ADD");
  });
});

// --- Template literal escaping ---

describe("serializeMigration — escaping", () => {
  it("should escape backticks and dollar signs in SQL", () => {
    const plan = makePlan([
      makeOp({
        type: "add_constraint",
        description: 'Add CHECK "chk_price" on "app"."products"',
        sql: 'ALTER TABLE "app"."products" ADD CONSTRAINT "chk_price" CHECK (price > $0);',
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    expect(result.content).toContain("\\$0");
  });

  it("should escape ${ sequences to prevent template literal interpolation", () => {
    // SQL containing ${ (e.g. a JSON path expression or parameterised placeholder
    // that happens to look like a template literal hole) must be escaped so that
    // the emitted TypeScript file compiles without syntax errors or unintended
    // variable references. escapeBacktick() replaces every $ with \$ which turns
    // ${ into \${ — safe inside a template literal.
    //
    // Construct the SQL string with a literal ${ using concatenation to avoid
    // accidental interpolation in this test file itself.
    const sqlWithDollarBrace =
      'ALTER TABLE "app"."events" ADD CONSTRAINT "chk_json" CHECK (payload->>' +
      "${jsonb_path});";
    const plan = makePlan([
      makeOp({
        type: "add_constraint",
        description: 'Add CHECK "chk_json" on "app"."events"',
        sql: sqlWithDollarBrace,
      }),
    ]);
    const result = serializeMigration(plan, emptySnapshot, { timestamp: fixedDate });
    // Every ${ in the content must be preceded by \ (i.e. no unescaped template holes)
    expect(result.content).not.toMatch(/(?<!\\)\${/);
    // The escaped form must be present in the content
    expect(result.content).toContain("\\${");
    expect(result.content).toMatchSnapshot();
  });
});

// --- Checksum stability ---

describe("serializeMigration — checksum", () => {
  it("should produce same checksum for equivalent SQL with different whitespace", () => {
    const plan1 = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "x" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "x" TEXT;',
      }),
    ]);
    const plan2 = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "x" to "app"."users"',
        sql: 'ALTER TABLE "app"."users"\n  ADD COLUMN "x"\n    TEXT;',
      }),
    ]);
    const r1 = serializeMigration(plan1, emptySnapshot, { timestamp: fixedDate });
    const r2 = serializeMigration(plan2, emptySnapshot, { timestamp: fixedDate });
    expect(r1.checksum).toBe(r2.checksum);
  });

  it("should produce different checksum for different SQL", () => {
    const plan1 = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "x" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "x" TEXT;',
      }),
    ]);
    const plan2 = makePlan([
      makeOp({
        type: "add_column",
        description: 'Add column "y" to "app"."users"',
        sql: 'ALTER TABLE "app"."users" ADD COLUMN "y" INTEGER;',
      }),
    ]);
    const r1 = serializeMigration(plan1, emptySnapshot, { timestamp: fixedDate });
    const r2 = serializeMigration(plan2, emptySnapshot, { timestamp: fixedDate });
    expect(r1.checksum).not.toBe(r2.checksum);
  });
});

// --- Import statement ---

describe("serializeMigration — imports", () => {
  it("should import from @lindorm/proteus", () => {
    const result = serializeMigration(makePlan([]), emptySnapshot, {
      timestamp: fixedDate,
    });
    expect(result.content).toContain(
      'import type { MigrationInterface, MigrationQueryRunner } from "@lindorm/proteus";',
    );
  });
});
