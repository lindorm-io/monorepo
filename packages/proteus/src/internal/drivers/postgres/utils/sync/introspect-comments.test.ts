import { introspectComments } from "../../../../drivers/postgres/utils/sync/introspect-comments.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import { describe, expect, it, vi } from "vitest";

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
): PostgresQueryClient => ({
  query: vi.fn().mockResolvedValue({ rows, rowCount: rows.length }),
});

describe("introspectComments", () => {
  it("should return empty array for empty schemas", async () => {
    const client = createMockClient();
    const result = await introspectComments(client, [], ["users"]);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return empty array for empty tables", async () => {
    const client = createMockClient();
    const result = await introspectComments(client, ["public"], []);
    expect(result).toEqual([]);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should return table-level comment", async () => {
    const client = createMockClient([
      {
        schema: "public",
        table: "users",
        column: null,
        comment: "Main users table",
      },
    ]);

    const result = await introspectComments(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should return column-level comments", async () => {
    const client = createMockClient([
      {
        schema: "public",
        table: "users",
        column: "email",
        comment: "Primary email address",
      },
      {
        schema: "public",
        table: "users",
        column: "name",
        comment: "Display name",
      },
    ]);

    const result = await introspectComments(client, ["public"], ["users"]);
    expect(result).toMatchSnapshot();
  });

  it("should return mixed table and column comments", async () => {
    const client = createMockClient([
      {
        schema: "public",
        table: "users",
        column: null,
        comment: "User accounts",
      },
      {
        schema: "public",
        table: "users",
        column: "id",
        comment: "Unique identifier",
      },
    ]);

    const result = await introspectComments(client, ["public"], ["users"]);
    expect(result).toHaveLength(2);
    expect(result[0].column).toBeNull();
    expect(result[1].column).toBe("id");
  });

  it("should pass schemas and tables as query parameters", async () => {
    const client = createMockClient([]);
    await introspectComments(client, ["public", "custom"], ["users", "posts"]);
    expect(client.query).toHaveBeenCalledWith(expect.any(String), [
      ["public", "custom"],
      ["users", "posts"],
    ]);
  });
});
