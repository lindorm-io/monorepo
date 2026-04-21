import { diffConstraints } from "../../../../drivers/postgres/utils/sync/diff-constraints.js";
import type { DbConstraint } from "../../types/db-snapshot.js";
import type { DesiredConstraint } from "../../types/desired-schema.js";
import { describe, expect, it } from "vitest";

const makeDbConstraint = (overrides: Partial<DbConstraint> = {}): DbConstraint => ({
  name: "test_constraint",
  type: "UNIQUE",
  columns: ["col"],
  foreignSchema: null,
  foreignTable: null,
  foreignColumns: null,
  onDelete: null,
  onUpdate: null,
  checkExpr: null,
  deferrable: false,
  initiallyDeferred: false,
  ...overrides,
});

const makeDesiredConstraint = (
  overrides: Partial<DesiredConstraint> = {},
): DesiredConstraint => ({
  name: "test_constraint",
  type: "UNIQUE",
  columns: ["col"],
  foreignSchema: null,
  foreignTable: null,
  foreignColumns: null,
  onDelete: null,
  onUpdate: null,
  checkExpr: null,
  deferrable: false,
  initiallyDeferred: false,
  ...overrides,
});

describe("diffConstraints", () => {
  it("should return empty for matching constraints", () => {
    const ops = diffConstraints(
      [makeDbConstraint()],
      [makeDesiredConstraint()],
      "public",
      "users",
    );
    expect(ops).toHaveLength(0);
  });

  it("should add new constraint", () => {
    const ops = diffConstraints(
      [],
      [makeDesiredConstraint({ name: "uq_email", columns: ["email"] })],
      "public",
      "users",
    );
    expect(ops).toMatchSnapshot();
  });

  it("should drop removed constraint", () => {
    const ops = diffConstraints(
      [makeDbConstraint({ name: "uq_old" })],
      [],
      "public",
      "users",
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].type).toBe("drop_constraint");
  });

  it("should drop and re-add changed constraint", () => {
    const ops = diffConstraints(
      [makeDbConstraint({ name: "uq_email", columns: ["email"] })],
      [makeDesiredConstraint({ name: "uq_email", columns: ["email", "name"] })],
      "public",
      "users",
    );
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("drop_constraint");
    expect(ops[1].type).toBe("add_constraint");
  });

  it("should add FK constraint", () => {
    const ops = diffConstraints(
      [],
      [
        makeDesiredConstraint({
          name: "fk_author",
          type: "FOREIGN KEY",
          columns: ["author_id"],
          foreignSchema: "public",
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "CASCADE",
          onUpdate: "NO ACTION",
        }),
      ],
      "public",
      "posts",
    );
    expect(ops).toMatchSnapshot();
  });

  it("should detect changed FK action", () => {
    const ops = diffConstraints(
      [
        makeDbConstraint({
          name: "fk_author",
          type: "FOREIGN KEY",
          columns: ["author_id"],
          foreignSchema: "public",
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "NO ACTION",
          onUpdate: "NO ACTION",
        }),
      ],
      [
        makeDesiredConstraint({
          name: "fk_author",
          type: "FOREIGN KEY",
          columns: ["author_id"],
          foreignSchema: "public",
          foreignTable: "users",
          foreignColumns: ["id"],
          onDelete: "CASCADE",
          onUpdate: "NO ACTION",
        }),
      ],
      "public",
      "posts",
    );
    // Should drop old and add new
    expect(ops).toHaveLength(2);
    expect(ops[0].type).toBe("drop_constraint");
    expect(ops[1].type).toBe("add_constraint");
  });

  it("should add CHECK constraint", () => {
    const ops = diffConstraints(
      [],
      [
        makeDesiredConstraint({
          name: "chk_age",
          type: "CHECK",
          columns: [],
          checkExpr: "CHECK (age >= 0)",
        }),
      ],
      "public",
      "users",
    );
    expect(ops[0].sql).toContain("CHECK (age >= 0)");
  });

  it("should add PRIMARY KEY constraint", () => {
    const ops = diffConstraints(
      [],
      [
        makeDesiredConstraint({
          name: "users_pkey",
          type: "PRIMARY KEY",
          columns: ["id"],
        }),
      ],
      "public",
      "users",
    );
    expect(ops[0].sql).toContain("PRIMARY KEY");
  });
});
