import { introspectEnums } from "../../../../drivers/postgres/utils/sync/introspect-enums.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { describe, expect, it, vi } from "vitest";

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

describe("introspectEnums", () => {
  it("should return empty array for empty schemas", async () => {
    const client = createMockClient();
    const result = await introspectEnums(client, []);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should map enum type with ordered values", async () => {
    const client = createMockClient([
      {
        schema: "public",
        name: "enum_users_status",
        values: ["active", "inactive", "banned"],
      },
    ]);

    const result = await introspectEnums(client, ["public"]);
    expect(result).toMatchSnapshot();
  });

  it("should handle multiple enums", async () => {
    const client = createMockClient([
      {
        schema: "public",
        name: "enum_users_status",
        values: ["active", "inactive"],
      },
      {
        schema: "public",
        name: "enum_posts_category",
        values: ["news", "blog", "tutorial"],
      },
    ]);

    const result = await introspectEnums(client, ["public"]);
    expect(result).toHaveLength(2);
    expect(result).toMatchSnapshot();
  });

  it("should handle enums across multiple schemas", async () => {
    const client = createMockClient([
      {
        schema: "tenant_a",
        name: "enum_users_role",
        values: ["admin", "user"],
      },
      {
        schema: "tenant_b",
        name: "enum_users_role",
        values: ["admin", "user", "moderator"],
      },
    ]);

    const result = await introspectEnums(client, ["tenant_a", "tenant_b"]);
    expect(result).toHaveLength(2);
    expect(result[0].schema).toBe("tenant_a");
    expect(result[1].schema).toBe("tenant_b");
  });

  it("should pass schemas as query parameter", async () => {
    const client = createMockClient([]);
    await introspectEnums(client, ["public", "custom"]);
    expect(client.query).toHaveBeenCalledWith(expect.any(String), [["public", "custom"]]);
  });
});
