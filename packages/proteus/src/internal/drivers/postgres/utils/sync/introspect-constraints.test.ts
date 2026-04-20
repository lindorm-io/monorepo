import { introspectConstraints } from "../../../../drivers/postgres/utils/sync/introspect-constraints";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import { describe, expect, it, vi } from "vitest";

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

describe("introspectConstraints", () => {
  it("should return empty array for empty schemas", async () => {
    const client = createMockClient();
    const result = await introspectConstraints(client, [], ["users"]);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return empty array for empty tables", async () => {
    const client = createMockClient();
    const result = await introspectConstraints(client, ["public"], []);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should map primary key constraint", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        constraint_name: "users_pkey",
        constraint_type: "p",
        column_names: ["id"],
        foreign_schema: null,
        foreign_table: null,
        foreign_columns: null,
        on_delete: null,
        on_update: null,
        check_expr: null,
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should map foreign key constraint with actions", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "posts",
        constraint_name: "fk_abc123",
        constraint_type: "f",
        column_names: ["author_id"],
        foreign_schema: "public",
        foreign_table: "users",
        foreign_columns: ["id"],
        on_delete: "c",
        on_update: "a",
        check_expr: null,
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["posts"]);
    expect(result).toMatchSnapshot();
  });

  it("should map all ON DELETE actions", async () => {
    const actions = [
      { code: "a", expected: "NO ACTION" },
      { code: "r", expected: "RESTRICT" },
      { code: "c", expected: "CASCADE" },
      { code: "n", expected: "SET NULL" },
      { code: "d", expected: "SET DEFAULT" },
    ];

    for (const { code, expected } of actions) {
      const client = createMockClient([
        {
          table_schema: "public",
          table_name: "posts",
          constraint_name: "fk_test",
          constraint_type: "f",
          column_names: ["user_id"],
          foreign_schema: "public",
          foreign_table: "users",
          foreign_columns: ["id"],
          on_delete: code,
          on_update: "a",
          check_expr: null,
          is_deferrable: false,
          initially_deferred: false,
        },
      ]);

      const result = await introspectConstraints(client, ["public"], ["posts"]);
      expect(result[0].constraint.onDelete).toBe(expected);
    }
  });

  it("should map unique constraint", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        constraint_name: "uq_abc123",
        constraint_type: "u",
        column_names: ["email"],
        foreign_schema: null,
        foreign_table: null,
        foreign_columns: null,
        on_delete: null,
        on_update: null,
        check_expr: null,
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should map check constraint", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "products",
        constraint_name: "chk_abc123",
        constraint_type: "c",
        column_names: ["price"],
        foreign_schema: null,
        foreign_table: null,
        foreign_columns: null,
        on_delete: null,
        on_update: null,
        check_expr: "CHECK ((price > 0))",
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["products"]);
    expect(result).toMatchSnapshot();
  });

  it("should map composite primary key", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "join_table",
        constraint_name: "join_table_pkey",
        constraint_type: "p",
        column_names: ["user_id", "role_id"],
        foreign_schema: null,
        foreign_table: null,
        foreign_columns: null,
        on_delete: null,
        on_update: null,
        check_expr: null,
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["join_table"]);
    expect(result[0].constraint.columns).toEqual(["user_id", "role_id"]);
    expect(result[0].constraint.type).toBe("PRIMARY KEY");
  });

  it("should null FK fields for non-FK constraints", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        constraint_name: "uq_email",
        constraint_type: "u",
        column_names: ["email"],
        foreign_schema: "public",
        foreign_table: "other",
        foreign_columns: ["col"],
        on_delete: "a",
        on_update: "a",
        check_expr: null,
        is_deferrable: false,
        initially_deferred: false,
      },
    ]);

    const result = await introspectConstraints(client, ["public"], ["users"]);
    expect(result[0].constraint.foreignSchema).toBeNull();
    expect(result[0].constraint.foreignTable).toBeNull();
    expect(result[0].constraint.foreignColumns).toBeNull();
    expect(result[0].constraint.onDelete).toBeNull();
    expect(result[0].constraint.onUpdate).toBeNull();
  });
});
