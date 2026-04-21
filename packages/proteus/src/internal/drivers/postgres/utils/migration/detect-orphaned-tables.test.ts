import type { DbSnapshot } from "../../types/db-snapshot.js";
import type { DesiredSchema } from "../../types/desired-schema.js";
import { detectOrphanedTables } from "./detect-orphaned-tables.js";
import { describe, expect, it } from "vitest";

const makeSnapshot = (tables: Array<{ schema: string; name: string }>): DbSnapshot => ({
  tables: tables.map((t) => ({
    ...t,
    columns: [],
    constraints: [],
    indexes: [],
    comment: null,
    columnComments: {},
    triggers: [],
  })),
  enums: [],
  schemas: [],
});

const makeDesired = (tables: Array<{ schema: string; name: string }>): DesiredSchema => ({
  tables: tables.map((t) => ({
    ...t,
    columns: [],
    constraints: [],
    indexes: [],
    comment: null,
    columnComments: {},
    triggers: [],
  })),
  enums: [],
  schemas: [],
  extensions: [],
});

describe("detectOrphanedTables", () => {
  it("should return empty when all snapshot tables are in desired", () => {
    const snapshot = makeSnapshot([
      { schema: "app", name: "users" },
      { schema: "app", name: "posts" },
    ]);
    const desired = makeDesired([
      { schema: "app", name: "users" },
      { schema: "app", name: "posts" },
    ]);

    const result = detectOrphanedTables(snapshot, desired);

    expect(result).toHaveLength(0);
  });

  it("should detect orphaned tables not in desired schema", () => {
    const snapshot = makeSnapshot([
      { schema: "app", name: "users" },
      { schema: "app", name: "old_table" },
      { schema: "app", name: "posts" },
    ]);
    const desired = makeDesired([
      { schema: "app", name: "users" },
      { schema: "app", name: "posts" },
    ]);

    const result = detectOrphanedTables(snapshot, desired);

    expect(result).toMatchSnapshot();
  });

  it("should handle empty snapshot", () => {
    const snapshot = makeSnapshot([]);
    const desired = makeDesired([{ schema: "app", name: "users" }]);

    const result = detectOrphanedTables(snapshot, desired);

    expect(result).toHaveLength(0);
  });

  it("should handle empty desired (all tables are orphaned)", () => {
    const snapshot = makeSnapshot([
      { schema: "app", name: "users" },
      { schema: "app", name: "posts" },
    ]);
    const desired = makeDesired([]);

    const result = detectOrphanedTables(snapshot, desired);

    expect(result).toHaveLength(2);
    expect(result).toMatchSnapshot();
  });

  it("should match by schema and name (cross-schema not considered orphaned)", () => {
    const snapshot = makeSnapshot([
      { schema: "app", name: "users" },
      { schema: "audit", name: "users" },
    ]);
    const desired = makeDesired([{ schema: "app", name: "users" }]);

    const result = detectOrphanedTables(snapshot, desired);

    expect(result).toHaveLength(1);
    expect(result[0]).toEqual({ schema: "audit", name: "users" });
  });
});
