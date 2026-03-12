import { PostgresSyncError } from "../../errors/PostgresSyncError";
import type { DbColumn } from "../../types/db-snapshot";
import type { DesiredColumn } from "../../types/desired-schema";
import { diffColumns } from "./diff-columns";

const makeDbCol = (overrides: Partial<DbColumn> = {}): DbColumn => ({
  name: "col",
  type: "text",
  nullable: false,
  defaultExpr: null,
  isIdentity: false,
  identityGeneration: null,
  isGenerated: false,
  generationExpr: null,
  collation: null,
  ...overrides,
});

const makeDesiredCol = (overrides: Partial<DesiredColumn> = {}): DesiredColumn => ({
  name: "col",
  pgType: "TEXT",
  nullable: false,
  defaultExpr: null,
  isIdentity: false,
  identityGeneration: null,
  isGenerated: false,
  generationExpr: null,
  collation: null,
  ...overrides,
});

describe("diffColumns", () => {
  it("should return empty for matching columns", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "id", type: "uuid" })],
      [makeDesiredCol({ name: "id", pgType: "UUID" })],
      "public",
      "users",
    );
    expect(ops).toHaveLength(0);
  });

  it("should add new column", () => {
    const ops = diffColumns(
      [],
      [makeDesiredCol({ name: "email", pgType: "TEXT", nullable: true })],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
  });

  it("should add NOT NULL column with temporary default", () => {
    const ops = diffColumns(
      [],
      [makeDesiredCol({ name: "score", pgType: "INTEGER" })],
      "public",
      "users",
    );
    // Should have ADD COLUMN with DEFAULT and then DROP DEFAULT
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("add_column");
    expect(ops[0].sql).toContain("DEFAULT 0");
    expect(ops[1].type).toBe("alter_column_default");
    expect(ops[1].sql).toContain("DROP DEFAULT");
  });

  it("should drop column", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "old_col", type: "text" })],
      [],
      "public",
      "users",
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("drop_column");
    expect(ops[0].severity).toBe("destructive");
  });

  it("should alter column type with safe cast", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "num", type: "integer" })],
      [makeDesiredCol({ name: "num", pgType: "BIGINT" })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("alter_column_type");
    expect(ops[0].sql).toContain("TYPE BIGINT");
  });

  it("should alter column type with USING cast", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "val", type: "text" })],
      [makeDesiredCol({ name: "val", pgType: "UUID" })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("alter_column_type");
    expect(ops[0].sql).toContain("USING");
  });

  it("should drop and readd for incompatible type change", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "val", type: "integer" })],
      [makeDesiredCol({ name: "val", pgType: "UUID" })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("drop_and_readd_column");
    expect(ops[0].severity).toBe("destructive");
  });

  it("should set NOT NULL with backfill", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "name", type: "text", nullable: true })],
      [makeDesiredCol({ name: "name", pgType: "TEXT", nullable: false })],
      "public",
      "users",
    );
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("backfill_column");
    expect(ops[0].sql).toContain("UPDATE");
    expect(ops[1].type).toBe("alter_column_nullable");
    expect(ops[1].sql).toContain("SET NOT NULL");
  });

  it("should drop NOT NULL", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "name", type: "text", nullable: false })],
      [makeDesiredCol({ name: "name", pgType: "TEXT", nullable: true })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("alter_column_nullable");
    expect(ops[0].sql).toContain("DROP NOT NULL");
    expect(ops[0].severity).toBe("safe");
  });

  it("should set default", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "score", type: "integer", defaultExpr: null })],
      [makeDesiredCol({ name: "score", pgType: "INTEGER", defaultExpr: "0" })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("alter_column_default");
    expect(ops[0].sql).toContain("SET DEFAULT 0");
  });

  it("should drop default", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "score", type: "integer", defaultExpr: "0" })],
      [makeDesiredCol({ name: "score", pgType: "INTEGER", defaultExpr: null })],
      "public",
      "users",
    );
    expect(ops[0].type).toBe("alter_column_default");
    expect(ops[0].sql).toContain("DROP DEFAULT");
  });

  it("should add identity", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "id", type: "bigint" })],
      [
        makeDesiredCol({
          name: "id",
          pgType: "BIGINT",
          isIdentity: true,
          identityGeneration: "ALWAYS",
        }),
      ],
      "public",
      "users",
    );
    expect(ops.some((o) => o.type === "alter_column_identity")).toBe(true);
  });

  it("should drop identity", () => {
    const ops = diffColumns(
      [
        makeDbCol({
          name: "id",
          type: "bigint",
          isIdentity: true,
          identityGeneration: "ALWAYS",
        }),
      ],
      [makeDesiredCol({ name: "id", pgType: "BIGINT" })],
      "public",
      "users",
    );
    expect(ops.some((o) => o.type === "alter_column_identity")).toBe(true);
    expect(ops.find((o) => o.type === "alter_column_identity")!.sql).toContain(
      "DROP IDENTITY",
    );
  });

  // BUG-3: VECTOR NOT NULL should throw when no explicit default
  it("should throw PostgresSyncError when adding VECTOR NOT NULL column without explicit default", () => {
    expect(() =>
      diffColumns(
        [],
        [makeDesiredCol({ name: "embedding", pgType: "VECTOR(384)", nullable: false })],
        "public",
        "items",
      ),
    ).toThrow(PostgresSyncError);
  });

  it("should throw PostgresSyncError when backfilling VECTOR NOT NULL column without explicit default", () => {
    expect(() =>
      diffColumns(
        [makeDbCol({ name: "embedding", type: "vector(384)", nullable: true })],
        [makeDesiredCol({ name: "embedding", pgType: "VECTOR(384)", nullable: false })],
        "public",
        "items",
      ),
    ).toThrow(PostgresSyncError);
  });

  it("should throw PostgresSyncError for VECTOR NOT NULL drop_readd without explicit default", () => {
    expect(() =>
      diffColumns(
        [makeDbCol({ name: "embedding", type: "integer" })],
        [makeDesiredCol({ name: "embedding", pgType: "VECTOR(384)", nullable: false })],
        "public",
        "items",
      ),
    ).toThrow(PostgresSyncError);
  });

  it("should allow VECTOR NOT NULL column when explicit default is provided", () => {
    const ops = diffColumns(
      [],
      [
        makeDesiredCol({
          name: "embedding",
          pgType: "VECTOR(384)",
          nullable: false,
          defaultExpr: "'[0,0,0]'",
        }),
      ],
      "public",
      "items",
    );
    expect(ops).toMatchSnapshot();
  });

  // BUG-12: word-bounded col replacement in USING clause
  it("should not corrupt column names containing 'col' substring in USING cast", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "protocol", type: "text" })],
      [makeDesiredCol({ name: "protocol", pgType: "UUID" })],
      "public",
      "connections",
    );
    expect(ops[0].type).toBe("alter_column_type");
    expect(ops[0].sql).toContain("USING");
    // The word "protocol" must remain intact — not mangled to "proto"protocol""
    expect(ops[0].sql).toContain('"protocol"');
    expect(ops[0].sql).not.toContain('proto"protocol"');
    expect(ops).toMatchSnapshot();
  });

  // BUG-2: quoteIdentifier usage
  it("should use quoteIdentifier for identifiers in SQL", () => {
    const ops = diffColumns(
      [],
      [makeDesiredCol({ name: "user name", pgType: "TEXT", nullable: true })],
      "public",
      "users",
    );
    // quoteIdentifier escapes double quotes inside identifiers
    expect(ops[0].sql).toContain('"user name"');
  });

  // P0-A: drop_readd + nullable change does NOT emit backfill/nullable ops
  it("should not emit backfill_column or alter_column_nullable when drop_readd also changes nullable", () => {
    // Column changes from INTEGER (nullable:true) to UUID (nullable:false) — incompatible type → drop_readd
    // The nullable change (true → false) must NOT produce a separate backfill+alter_column_nullable
    // because the re-add already includes NOT NULL DEFAULT in the ADD COLUMN statement.
    const ops = diffColumns(
      [makeDbCol({ name: "val", type: "integer", nullable: true })],
      [makeDesiredCol({ name: "val", pgType: "UUID", nullable: false })],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
    // Only drop_and_readd_column ops (drop + readd) and the alter_column_default DROP DEFAULT
    // should appear — never backfill_column or alter_column_nullable.
    const types = ops.map((o) => o.type);
    expect(types).not.toContain("backfill_column");
    expect(types).not.toContain("alter_column_nullable");
    expect(
      types.every((t) => t === "drop_and_readd_column" || t === "alter_column_default"),
    ).toBe(true);
  });

  // P0-B: computed column re-add includes NOT NULL when nullable:false
  it("should include NOT NULL in re-add SQL for computed column with nullable:false", () => {
    const ops = diffColumns(
      [
        makeDbCol({
          name: "total",
          type: "integer",
          isGenerated: true,
          generationExpr: "a + b",
        }),
      ],
      [
        makeDesiredCol({
          name: "total",
          pgType: "BIGINT",
          nullable: false,
          isGenerated: true,
          generationExpr: "a + b + c",
        }),
      ],
      "public",
      "orders",
    );
    expect(ops).toMatchSnapshot();
    const readdOp = ops.find(
      (o) => o.type === "drop_and_readd_column" && o.sql.includes("ADD COLUMN"),
    );
    expect(readdOp).toBeDefined();
    expect(readdOp!.sql).toContain("NOT NULL");
    expect(readdOp!.sql).toContain("GENERATED ALWAYS AS");
  });

  // P0-B: computed column re-add allows nullable (no NOT NULL)
  it("should omit NOT NULL from re-add SQL for computed column with nullable:true", () => {
    const ops = diffColumns(
      [
        makeDbCol({
          name: "total",
          type: "integer",
          isGenerated: true,
          generationExpr: "a + b",
        }),
      ],
      [
        makeDesiredCol({
          name: "total",
          pgType: "BIGINT",
          nullable: true,
          isGenerated: true,
          generationExpr: "a + b + c",
        }),
      ],
      "public",
      "orders",
    );
    expect(ops).toMatchSnapshot();
    const readdOp = ops.find(
      (o) => o.type === "drop_and_readd_column" && o.sql.includes("ADD COLUMN"),
    );
    expect(readdOp).toBeDefined();
    expect(readdOp!.sql).not.toContain("NOT NULL");
    expect(readdOp!.sql).toContain("GENERATED ALWAYS AS");
  });

  // P1-F: drop_readd drops temporary default when NOT NULL column has no explicit default
  it("should emit DROP DEFAULT after drop_readd for NOT NULL column with no explicit default", () => {
    // INTEGER → UUID (incompatible), nullable:false, no defaultExpr
    // A temporary zero-value UUID default is used for the re-add; must be cleaned up afterward.
    const ops = diffColumns(
      [makeDbCol({ name: "ref", type: "integer", nullable: false })],
      [makeDesiredCol({ name: "ref", pgType: "UUID", nullable: false })],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
    const dropDefaultOp = ops.find(
      (o) => o.type === "alter_column_default" && o.sql.includes("DROP DEFAULT"),
    );
    expect(dropDefaultOp).toBeDefined();
    // Confirm it is emitted after the re-add op
    const readdIdx = ops.findIndex(
      (o) => o.type === "drop_and_readd_column" && o.sql.includes("ADD COLUMN"),
    );
    const dropDefaultIdx = ops.findIndex(
      (o) => o.type === "alter_column_default" && o.sql.includes("DROP DEFAULT"),
    );
    expect(dropDefaultIdx).toBeGreaterThan(readdIdx);
  });

  // P1-F: drop_readd with explicit default does NOT emit an extra DROP DEFAULT
  it("should not emit extra DROP DEFAULT after drop_readd when column has explicit default", () => {
    // INTEGER → UUID (incompatible), nullable:false, explicit defaultExpr provided
    // The explicit default is intentional — no temporary default was used, so no cleanup needed.
    const ops = diffColumns(
      [makeDbCol({ name: "ref", type: "integer", nullable: false })],
      [
        makeDesiredCol({
          name: "ref",
          pgType: "UUID",
          nullable: false,
          defaultExpr: "'00000000-0000-0000-0000-000000000001'",
        }),
      ],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
    const dropDefaultOps = ops.filter(
      (o) => o.type === "alter_column_default" && o.sql.includes("DROP DEFAULT"),
    );
    expect(dropDefaultOps).toHaveLength(0);
  });

  // Collation diff: collation-only change (type stays the same)
  it("should emit alter_column_type when only collation changes", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "title", type: "text", collation: null })],
      [makeDesiredCol({ name: "title", pgType: "TEXT", collation: "en-US-x-icu" })],
      "public",
      "test_table",
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("alter_column_type");
    expect(ops[0].severity).toBe("warning");
  });

  it("should include COLLATE clause in SQL for collation-only change", () => {
    const ops = diffColumns(
      [makeDbCol({ name: "title", type: "text", collation: null })],
      [makeDesiredCol({ name: "title", pgType: "TEXT", collation: "en-US-x-icu" })],
      "public",
      "test_table",
    );
    expect(ops[0].sql).toMatchSnapshot();
    expect(ops[0].sql).toContain('COLLATE "en-US-x-icu"');
  });

  it("should include COLLATE clause in type change ALTER when desired has collation", () => {
    // TEXT → VARCHAR(255) (safe alter) with collation on desired column
    const ops = diffColumns(
      [makeDbCol({ name: "title", type: "text", collation: null })],
      [
        makeDesiredCol({
          name: "title",
          pgType: "VARCHAR(255)",
          collation: "en-US-x-icu",
        }),
      ],
      "public",
      "test_table",
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("alter_column_type");
    expect(ops[0].sql).toMatchSnapshot();
    expect(ops[0].sql).toContain('COLLATE "en-US-x-icu"');
  });

  it("should not emit collation op when collation is unchanged", () => {
    // Both db and desired have the same collation — no diff expected
    const ops = diffColumns(
      [makeDbCol({ name: "title", type: "text", collation: "en-US-x-icu" })],
      [makeDesiredCol({ name: "title", pgType: "TEXT", collation: "en-US-x-icu" })],
      "public",
      "test_table",
    );
    expect(ops).toHaveLength(0);
  });

  it("should include COLLATE in drop_readd re-add SQL when desired has collation", () => {
    // INTEGER → UUID (incompatible drop_readd) with collation on desired
    const ops = diffColumns(
      [makeDbCol({ name: "ref", type: "integer", nullable: true, collation: null })],
      [
        makeDesiredCol({
          name: "ref",
          pgType: "UUID",
          nullable: true,
          collation: "en-US-x-icu",
        }),
      ],
      "public",
      "test_table",
    );
    const readdOp = ops.find(
      (o) => o.type === "drop_and_readd_column" && o.sql.includes("ADD COLUMN"),
    );
    expect(readdOp).toBeDefined();
    expect(readdOp!.sql).toMatchSnapshot();
    expect(readdOp!.sql).toContain('COLLATE "en-US-x-icu"');
  });

  // P0-A: columnReplaced skips default change when drop_readd occurs
  it("should not emit alter_column_default for default change when column is replaced via drop_readd", () => {
    // INTEGER → UUID (incompatible) AND default changed: db has '42' desired has '99'
    // After drop_readd, the re-add SQL already includes the new default — no separate default op needed.
    const ops = diffColumns(
      [makeDbCol({ name: "ref", type: "integer", nullable: false, defaultExpr: "42" })],
      [
        makeDesiredCol({
          name: "ref",
          pgType: "UUID",
          nullable: false,
          defaultExpr: "'99'",
        }),
      ],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
    // Only drop_and_readd_column ops — no alter_column_default for the default diff
    const alterDefaultOps = ops.filter((o) => o.type === "alter_column_default");
    expect(alterDefaultOps).toHaveLength(0);
  });
});
