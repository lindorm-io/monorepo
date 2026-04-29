import { introspectIndexes } from "../../../../drivers/postgres/utils/sync/introspect-indexes.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { describe, expect, it, vi } from "vitest";

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

describe("introspectIndexes", () => {
  it("should return empty array for empty schemas", async () => {
    const client = createMockClient();
    const result = await introspectIndexes(client, [], ["users"]);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return empty array for empty tables", async () => {
    const client = createMockClient();
    const result = await introspectIndexes(client, ["public"], []);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should map a simple btree index", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        index_name: "idx_abc123",
        is_unique: false,
        method: "btree",
        column_names: ["email"],
        column_options: [0],
        num_key_columns: 1,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should detect DESC direction from indoption bit 0", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "events",
        index_name: "idx_created",
        is_unique: false,
        method: "btree",
        column_names: ["created_at"],
        column_options: [1],
        num_key_columns: 1,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["events"]);
    expect(result[0].index.columns[0].direction).toBe("desc");
  });

  it("should handle composite index with mixed directions", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "logs",
        index_name: "idx_composite",
        is_unique: false,
        method: "btree",
        column_names: ["tenant_id", "created_at"],
        column_options: [0, 1],
        num_key_columns: 2,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["logs"]);
    expect(result[0].index.columns).toEqual([
      { name: "tenant_id", direction: "asc" },
      { name: "created_at", direction: "desc" },
    ]);
  });

  it("should separate INCLUDE columns", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        index_name: "idx_email_inc",
        is_unique: true,
        method: "btree",
        column_names: ["email", "name", "avatar"],
        column_options: [0, 0, 0],
        num_key_columns: 1,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["users"]);
    expect(result[0].index.columns).toEqual([{ name: "email", direction: "asc" }]);
    expect(result[0].index.include).toEqual(["name", "avatar"]);
  });

  it("should handle partial index with WHERE predicate", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        index_name: "idx_active",
        is_unique: false,
        method: "btree",
        column_names: ["email"],
        column_options: [0],
        num_key_columns: 1,
        predicate: "(active = true)",
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["users"]);
    expect(result[0].index.where).toBe("(active = true)");
  });

  it("should handle GIN index method", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "documents",
        index_name: "idx_data_gin",
        is_unique: false,
        method: "gin",
        column_names: ["data"],
        column_options: [0],
        num_key_columns: 1,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["documents"]);
    expect(result[0].index.method).toBe("gin");
  });

  it("should handle unique index flag", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        index_name: "idx_unique_email",
        is_unique: true,
        method: "btree",
        column_names: ["email"],
        column_options: [0],
        num_key_columns: 1,
        predicate: null,
      },
    ]);

    const result = await introspectIndexes(client, ["public"], ["users"]);
    expect(result[0].index.unique).toBe(true);
  });
});
