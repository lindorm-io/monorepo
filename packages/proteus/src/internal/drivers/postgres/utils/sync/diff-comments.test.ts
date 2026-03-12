import { diffComments } from "../../../../drivers/postgres/utils/sync/diff-comments";
import type { DbTable } from "../../types/db-snapshot";
import type { DesiredTable } from "../../types/desired-schema";

const makeDbTable = (overrides: Partial<DbTable> = {}): DbTable => ({
  schema: "public",
  name: "users",
  columns: [],
  constraints: [],
  indexes: [],
  comment: null,
  columnComments: {},
  ...overrides,
});

const makeDesiredTable = (overrides: Partial<DesiredTable> = {}): DesiredTable => ({
  schema: "public",
  name: "users",
  columns: [],
  constraints: [],
  indexes: [],
  comment: null,
  columnComments: {},
  ...overrides,
});

describe("diffComments", () => {
  it("should return empty for matching comments", () => {
    const ops = diffComments(
      makeDbTable({ comment: "Users", columnComments: { id: "PK" } }),
      makeDesiredTable({ comment: "Users", columnComments: { id: "PK" } }),
    );
    expect(ops).toHaveLength(0);
  });

  it("should add table comment", () => {
    const ops = diffComments(
      makeDbTable(),
      makeDesiredTable({ comment: "User accounts" }),
    );
    expect(ops).toMatchSnapshot();
  });

  it("should remove table comment", () => {
    const ops = diffComments(makeDbTable({ comment: "Old comment" }), makeDesiredTable());
    expect(ops[0].sql).toContain("IS NULL");
  });

  it("should add column comment", () => {
    const ops = diffComments(
      makeDbTable(),
      makeDesiredTable({ columnComments: { email: "Primary email" } }),
    );
    expect(ops).toMatchSnapshot();
  });

  it("should remove column comment", () => {
    const ops = diffComments(
      makeDbTable({ columnComments: { email: "Old" } }),
      makeDesiredTable(),
    );
    expect(ops[0].sql).toContain("IS NULL");
  });

  it("should update column comment", () => {
    const ops = diffComments(
      makeDbTable({ columnComments: { email: "Old" } }),
      makeDesiredTable({ columnComments: { email: "New" } }),
    );
    expect(ops).toHaveLength(1);
    expect(ops[0].sql).toContain("New");
  });
});
