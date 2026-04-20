import type { SyncOperation } from "../../drivers/postgres/types/sync-plan";
import type { EntityMetadata } from "../../entity/types/metadata";
import { groupOperationsByEntity } from "./group-operations";
import { describe, expect, it, vi } from "vitest";

vi.mock("../../entity/utils/get-entity-name", () => ({
  getEntityName: vi.fn((target: Function, options: { namespace?: string }) => ({
    namespace: options.namespace ?? null,
    name: target.name.toLowerCase(),
    type: "entity",
    parts: [options.namespace, "entity", target.name.toLowerCase()].filter(Boolean),
  })),
}));

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

const makeMeta = (name: string): EntityMetadata =>
  ({
    target: { name } as any,
  }) as any;

describe("groupOperationsByEntity", () => {
  it("should group operations by entity table name", () => {
    const ops = [
      makeOp({ table: "users", schema: "app" }),
      makeOp({ table: "users", schema: "app" }),
      makeOp({ table: "orders", schema: "app" }),
    ];
    const metadata = [makeMeta("users"), makeMeta("orders")];

    const result = groupOperationsByEntity(ops, metadata, "app");

    expect(result.groups).toHaveLength(2);
    expect(result.groups[0].entityName).toBe("users");
    expect(result.groups[0].operations).toHaveLength(2);
    expect(result.groups[1].entityName).toBe("orders");
    expect(result.groups[1].operations).toHaveLength(1);
  });

  it("should put table=null operations in ungrouped", () => {
    const ops = [
      makeOp({ table: null, schema: "app", type: "create_schema" }),
      makeOp({ table: "users", schema: "app" }),
    ];
    const metadata = [makeMeta("users")];

    const result = groupOperationsByEntity(ops, metadata, "app");

    expect(result.ungrouped).toHaveLength(1);
    expect(result.groups).toHaveLength(1);
  });

  it("should mark unknown tables as join tables", () => {
    const ops = [makeOp({ table: "users_x_orders", schema: "app" })];
    const metadata = [makeMeta("users"), makeMeta("orders")];

    const result = groupOperationsByEntity(ops, metadata, "app");

    expect(result.groups).toHaveLength(1);
    expect(result.groups[0].isJoinTable).toBe(true);
  });

  it("should count destructive operations per group", () => {
    const ops = [
      makeOp({ table: "users", schema: "app", severity: "safe" }),
      makeOp({ table: "users", schema: "app", severity: "destructive" }),
      makeOp({ table: "users", schema: "app", severity: "destructive" }),
    ];
    const metadata = [makeMeta("users")];

    const result = groupOperationsByEntity(ops, metadata, "app");

    expect(result.groups[0].destructiveCount).toBe(2);
  });
});
