import { introspectTables } from "../../../../drivers/postgres/utils/sync/introspect-tables.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { describe, expect, it, vi } from "vitest";

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

describe("introspectTables", () => {
  it("should return empty array for empty schemas", async () => {
    const client = createMockClient();
    const result = await introspectTables(client, [], ["users"]);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return empty array for empty tables", async () => {
    const client = createMockClient();
    const result = await introspectTables(client, ["public"], []);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should map column rows to DbTable structures", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        column_name: "id",
        formatted_type: "uuid",
        is_nullable: false,
        default_expr: "gen_random_uuid()",
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
      {
        table_schema: "public",
        table_name: "users",
        column_name: "name",
        formatted_type: "text",
        is_nullable: true,
        default_expr: null,
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: "en_US.utf8",
      },
    ]);

    const result = await introspectTables(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should handle identity columns", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "counters",
        column_name: "id",
        formatted_type: "bigint",
        is_nullable: false,
        default_expr: null,
        is_identity: true,
        identity_generation: "ALWAYS",
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
    ]);

    const result = await introspectTables(client, ["public"], ["counters"]);
    expect(result).toMatchSnapshot();
  });

  it("should handle generated columns", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "products",
        column_name: "total",
        formatted_type: "numeric(10,2)",
        is_nullable: false,
        default_expr: "(price * quantity)",
        is_identity: false,
        identity_generation: null,
        is_generated: true,
        generation_expr: "(price * quantity)",
        collation_name: null,
      },
    ]);

    const result = await introspectTables(client, ["public"], ["products"]);
    expect(result).toMatchSnapshot();
  });

  it("should group columns by table", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "users",
        column_name: "id",
        formatted_type: "uuid",
        is_nullable: false,
        default_expr: null,
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
      {
        table_schema: "public",
        table_name: "posts",
        column_name: "id",
        formatted_type: "uuid",
        is_nullable: false,
        default_expr: null,
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
    ]);

    const result = await introspectTables(client, ["public"], ["users", "posts"]);
    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("users");
    expect(result[1].name).toBe("posts");
  });

  it("should suppress default_expr for identity columns", async () => {
    const client = createMockClient([
      {
        table_schema: "public",
        table_name: "items",
        column_name: "id",
        formatted_type: "integer",
        is_nullable: false,
        default_expr: "nextval('items_id_seq'::regclass)",
        is_identity: true,
        identity_generation: "BY DEFAULT",
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
    ]);

    const result = await introspectTables(client, ["public"], ["items"]);
    expect(result[0].columns[0].defaultExpr).toBeNull();
    expect(result[0].columns[0].isIdentity).toBe(true);
    expect(result[0].columns[0].identityGeneration).toBe("BY DEFAULT");
  });

  it("should handle multiple schemas", async () => {
    const client = createMockClient([
      {
        table_schema: "tenant_a",
        table_name: "users",
        column_name: "id",
        formatted_type: "uuid",
        is_nullable: false,
        default_expr: null,
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
      {
        table_schema: "tenant_b",
        table_name: "users",
        column_name: "id",
        formatted_type: "uuid",
        is_nullable: false,
        default_expr: null,
        is_identity: false,
        identity_generation: null,
        is_generated: false,
        generation_expr: null,
        collation_name: null,
      },
    ]);

    const result = await introspectTables(client, ["tenant_a", "tenant_b"], ["users"]);
    expect(result).toHaveLength(2);
    expect(result[0].schema).toBe("tenant_a");
    expect(result[1].schema).toBe("tenant_b");
  });
});
