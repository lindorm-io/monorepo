import type { SyncOperation } from "#internal/drivers/postgres/types/sync-plan";
import type { EntityGroup } from "./group-operations";
import { filterOperationsByEntities } from "./filter-operations";

const makeOp = (overrides: Partial<SyncOperation>): SyncOperation => ({
  type: "add_column",
  severity: "safe",
  schema: "app",
  table: "users",
  description: "test op",
  sql: "SELECT 1",
  autocommit: false,
  ...overrides,
});

const makeGroup = (overrides: Partial<EntityGroup>): EntityGroup => ({
  entityName: "User",
  tableName: "app.users",
  operations: [],
  destructiveCount: 0,
  isJoinTable: false,
  ...overrides,
});

describe("filterOperationsByEntities", () => {
  it("should include operations for selected tables", () => {
    const ops = [
      makeOp({ table: "users", schema: "app" }),
      makeOp({ table: "orders", schema: "app" }),
    ];
    const selected = [makeGroup({ tableName: "app.users" })];

    const result = filterOperationsByEntities(ops, selected, []);

    expect(result).toHaveLength(1);
    expect(result[0].table).toBe("users");
  });

  it("should exclude operations for unselected tables", () => {
    const ops = [
      makeOp({ table: "users", schema: "app" }),
      makeOp({ table: "orders", schema: "app" }),
    ];
    const selected = [makeGroup({ tableName: "app.users" })];

    const result = filterOperationsByEntities(ops, selected, []);

    expect(result.some((o) => o.table === "orders")).toBe(false);
  });

  it("should include ungrouped ops for matching schemas", () => {
    const ops = [makeOp({ table: "users", schema: "app" })];
    const ungrouped = [
      makeOp({ table: null, schema: "app", type: "create_schema" }),
      makeOp({ table: null, schema: "other", type: "create_schema" }),
    ];
    const selected = [makeGroup({ tableName: "app.users" })];

    const result = filterOperationsByEntities(ops, selected, ungrouped);

    expect(result).toHaveLength(2); // users op + app schema op
  });

  it("should include ungrouped ops without schema unconditionally", () => {
    const ops = [makeOp({ table: "users", schema: "app" })];
    const ungrouped = [makeOp({ table: null, schema: null, type: "create_extension" })];
    const selected = [makeGroup({ tableName: "app.users" })];

    const result = filterOperationsByEntities(ops, selected, ungrouped);

    expect(result).toHaveLength(2);
  });
});
