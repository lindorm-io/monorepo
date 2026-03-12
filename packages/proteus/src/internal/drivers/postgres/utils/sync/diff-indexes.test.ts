import { diffIndexes } from "../../../../drivers/postgres/utils/sync/diff-indexes";
import type { DbIndex } from "../../types/db-snapshot";
import type { DesiredIndex } from "../../types/desired-schema";

const makeDbIndex = (overrides: Partial<DbIndex> = {}): DbIndex => ({
  name: "idx_test",
  unique: false,
  columns: [{ name: "col", direction: "asc" }],
  method: "btree",
  where: null,
  include: [],
  ...overrides,
});

const makeDesiredIndex = (overrides: Partial<DesiredIndex> = {}): DesiredIndex => ({
  name: "idx_test",
  unique: false,
  columns: [{ name: "col", direction: "asc" }],
  method: "btree",
  where: null,
  include: null,
  concurrent: false,
  ...overrides,
});

describe("diffIndexes", () => {
  it("should return empty for matching indexes", () => {
    const ops = diffIndexes([makeDbIndex()], [makeDesiredIndex()], "public", "users");
    expect(ops).toHaveLength(0);
  });

  it("should create new index", () => {
    const ops = diffIndexes(
      [],
      [
        makeDesiredIndex({
          name: "idx_email",
          columns: [{ name: "email", direction: "asc" }],
        }),
      ],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
  });

  it("should drop removed index", () => {
    const ops = diffIndexes([makeDbIndex({ name: "idx_old" })], [], "public", "users");
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("drop_index");
  });

  it("should drop and recreate changed index", () => {
    const ops = diffIndexes(
      [makeDbIndex({ name: "idx_col", unique: false })],
      [makeDesiredIndex({ name: "idx_col", unique: true })],
      "public",
      "users",
    );
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("drop_index");
    expect(ops[1].type).toBe("create_index");
    expect(ops[1].sql).toContain("UNIQUE");
  });

  it("should detect direction change", () => {
    const ops = diffIndexes(
      [makeDbIndex({ name: "idx_col", columns: [{ name: "col", direction: "asc" }] })],
      [
        makeDesiredIndex({
          name: "idx_col",
          columns: [{ name: "col", direction: "desc" }],
        }),
      ],
      "public",
      "users",
    );
    expect(ops).toHaveLength(2);
  });

  it("should handle GIN method", () => {
    const ops = diffIndexes(
      [],
      [
        makeDesiredIndex({
          name: "idx_data",
          method: "gin",
          columns: [{ name: "data", direction: "asc" }],
        }),
      ],
      "public",
      "docs",
    );
    expect(ops[0].sql).toContain("USING gin");
  });

  it("should handle WHERE clause", () => {
    const ops = diffIndexes(
      [],
      [makeDesiredIndex({ name: "idx_active", where: "active = true" })],
      "public",
      "users",
    );
    expect(ops[0].sql).toContain("WHERE active = true");
  });

  it("should handle INCLUDE columns", () => {
    const ops = diffIndexes(
      [],
      [makeDesiredIndex({ name: "idx_covering", include: ["name", "email"] })],
      "public",
      "users",
    );
    expect(ops[0].sql).toContain("INCLUDE");
    expect(ops[0].sql).toContain('"name"');
  });

  it("should set autocommit for concurrent indexes", () => {
    const ops = diffIndexes(
      [],
      [makeDesiredIndex({ name: "idx_conc", concurrent: true })],
      "public",
      "users",
    );
    expect(ops[0].autocommit).toBe(true);
    expect(ops[0].sql).toContain("CONCURRENTLY");
  });

  // BUG-4: schema-qualified type casts in WHERE predicates should match
  it("should match indexes when DB WHERE has schema-qualified type casts", () => {
    const ops = diffIndexes(
      [
        makeDbIndex({
          name: "idx_status",
          columns: [{ name: "status", direction: "asc" }],
          where: "((status)::public.enum_status = 'active'::public.enum_status)",
        }),
      ],
      [
        makeDesiredIndex({
          name: "idx_status",
          columns: [{ name: "status", direction: "asc" }],
          where: "status = 'active'",
        }),
      ],
      "public",
      "users",
    );
    // Should match — no drop+recreate needed
    expect(ops).toHaveLength(0);
  });

  it("should match indexes with simple type casts and schema-qualified casts", () => {
    const ops = diffIndexes(
      [
        makeDbIndex({
          name: "idx_mixed",
          columns: [{ name: "val", direction: "asc" }],
          where:
            "((val)::myschema.custom_type = 'x'::myschema.custom_type AND (name)::text = 'y'::text)",
        }),
      ],
      [
        makeDesiredIndex({
          name: "idx_mixed",
          columns: [{ name: "val", direction: "asc" }],
          where: "val = 'x' AND name = 'y'",
        }),
      ],
      "public",
      "items",
    );
    expect(ops).toHaveLength(0);
  });
});
