import { makeField } from "../../../__fixtures__/make-field";
import type { EntityMetadata } from "../../../entity/types/metadata";
import type { PostgresQueryClient } from "../types/postgres-query-client";
import { PostgresExecutor } from "./PostgresExecutor";
import { describe, expect, test, vi, type Mock } from "vitest";

class UserEntity {
  id: string = "";
  name: string = "";
  email: string = "";
  version: number = 0;
  deletedAt: Date | null = null;
  expiresAt: Date | null = null;
}

const metadata = {
  entity: {
    decorator: "Entity",
    cache: null,
    comment: null,
    database: null,
    name: "users",
    namespace: "app",
  },
  target: UserEntity,
  fields: [
    makeField("id", { type: "uuid" }),
    makeField("name", { type: "string" }),
    makeField("email", { type: "string", name: "email_address" }),
    makeField("version", { type: "integer", decorator: "Version" }),
    makeField("deletedAt", {
      type: "timestamp",
      decorator: "DeleteDate",
      name: "deleted_at",
      nullable: true,
    }),
    makeField("expiresAt", {
      type: "timestamp",
      decorator: "ExpiryDate",
      name: "expires_at",
      nullable: true,
    }),
  ],
  relations: [],
  primaryKeys: ["id"],
  generated: [],
  hooks: [],
} as unknown as EntityMetadata;

const createMockClient = (
  rows: Array<Record<string, unknown>> = [],
  rowCount?: number,
): {
  client: PostgresQueryClient;
  queries: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
  return {
    client: {
      query: vi.fn(
        async <R = Record<string, unknown>>(sql: string, params?: Array<unknown>) => {
          queries.push({ sql, params });
          return { rows: rows as Array<R>, rowCount: rowCount ?? rows.length };
        },
      ),
    } as PostgresQueryClient,
    queries,
  };
};

describe("PostgresExecutor", () => {
  describe("executeInsert", () => {
    test("should insert and return hydrated entity", async () => {
      const { client, queries } = createMockClient([
        {
          id: "abc-123",
          name: "Alice",
          email_address: "alice@example.com",
          version: 1,
          deleted_at: null,
          expires_at: null,
        },
      ]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeInsert({
        id: "abc-123",
        name: "Alice",
        email: "alice@example.com",
        version: 1,
        deletedAt: null,
        expiresAt: null,
      } as any);

      expect(queries).toHaveLength(1);
      expect(queries[0].sql).toContain("INSERT INTO");
      expect(queries[0].sql).toContain("RETURNING *");
      expect((result as any).id).toBe("abc-123");
      expect((result as any).email).toBe("alice@example.com");
    });
  });

  describe("executeUpdate", () => {
    test("should update and return hydrated entity", async () => {
      const { client } = createMockClient([
        {
          id: "abc-123",
          name: "Alice Updated",
          email_address: "alice@example.com",
          version: 2,
          deleted_at: null,
          expires_at: null,
        },
      ]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeUpdate({
        id: "abc-123",
        name: "Alice Updated",
        email: "alice@example.com",
        version: 2,
        deletedAt: null,
        expiresAt: null,
      } as any);

      expect((result as any).name).toBe("Alice Updated");
    });

    test("should throw OptimisticLockError when rowCount is 0 and entity has version", async () => {
      const { client } = createMockClient([], 0);
      const executor = new PostgresExecutor(client, metadata);

      await expect(
        executor.executeUpdate({
          id: "abc-123",
          name: "Alice",
          email: "alice@example.com",
          version: 2,
          deletedAt: null,
          expiresAt: null,
        } as any),
      ).rejects.toThrow("Optimistic lock failed");
    });

    test("should throw PostgresExecutorError when rowCount is 0 and no version field", async () => {
      const noVersionMetadata = {
        ...metadata,
        fields: metadata.fields.filter((f) => f.decorator !== "Version"),
      } as unknown as EntityMetadata;
      const { client } = createMockClient([], 0);
      const executor = new PostgresExecutor(client, noVersionMetadata);

      await expect(
        executor.executeUpdate({
          id: "abc-123",
          name: "Alice",
          email: "alice@example.com",
          deletedAt: null,
          expiresAt: null,
        } as any),
      ).rejects.toThrow("Update failed");
    });
  });

  describe("executeDelete", () => {
    test("should execute delete", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await executor.executeDelete({ id: "abc-123" } as any);

      expect(queries[0].sql).toContain("DELETE FROM");
    });

    test("should throw on empty criteria", async () => {
      const { client } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await expect(executor.executeDelete({} as any)).rejects.toThrow(
        "requires non-empty criteria",
      );
    });
  });

  describe("executeSoftDelete", () => {
    test("should execute soft delete", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await executor.executeSoftDelete({ id: "abc-123" } as any);

      expect(queries[0].sql).toContain("SET");
      expect(queries[0].sql).toContain("NOW()");
    });

    test("should throw on empty criteria", async () => {
      const { client } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await expect(executor.executeSoftDelete({} as any)).rejects.toThrow(
        "requires non-empty criteria",
      );
    });
  });

  describe("executeRestore", () => {
    test("should execute restore", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await executor.executeRestore({ id: "abc-123" } as any);

      expect(queries[0].sql).toContain("NULL");
    });

    test("should throw on empty criteria", async () => {
      const { client } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await expect(executor.executeRestore({} as any)).rejects.toThrow(
        "requires non-empty criteria",
      );
    });
  });

  describe("executeDeleteExpired", () => {
    test("should execute delete expired", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await executor.executeDeleteExpired();

      expect(queries[0].sql).toContain("DELETE FROM");
      expect(queries[0].sql).toContain("NOW()");
    });

    test("should no-op when no ExpiryDate field", async () => {
      const noExpiryMetadata = {
        ...metadata,
        fields: metadata.fields.filter((f) => f.decorator !== "ExpiryDate"),
      } as unknown as EntityMetadata;
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, noExpiryMetadata);
      await executor.executeDeleteExpired();

      expect(queries).toHaveLength(0);
    });
  });

  describe("executeTtl", () => {
    test("should return TTL in milliseconds", async () => {
      const futureDate = new Date(Date.now() + 3600_000);
      const { client } = createMockClient([
        {
          expires_at: futureDate,
          id: null,
          name: null,
          email_address: null,
          version: null,
          deleted_at: null,
        },
      ]);
      // Mock needs t0_fieldKey format for hydrateRows
      (client.query as Mock).mockResolvedValueOnce({
        rows: [{ t0_expiresAt: futureDate }],
        rowCount: 1,
      });
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeTtl({ id: "abc-123" } as any);

      expect(result).toBeGreaterThan(3500_000);
      expect(result).toBeLessThanOrEqual(3600_000);
    });

    test("should return null when entity not found", async () => {
      const { client } = createMockClient([]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeTtl({ id: "abc-123" } as any);

      expect(result).toBeNull();
    });

    test("should return null when no ExpiryDate field", async () => {
      const noExpiryMetadata = {
        ...metadata,
        fields: metadata.fields.filter((f) => f.decorator !== "ExpiryDate"),
      } as unknown as EntityMetadata;
      const { client } = createMockClient();
      const executor = new PostgresExecutor(client, noExpiryMetadata);
      const result = await executor.executeTtl({ id: "abc-123" } as any);

      expect(result).toBeNull();
    });

    test("should return 0 for expired entities", async () => {
      const pastDate = new Date(Date.now() - 3600_000);
      const { client } = createMockClient();
      (client.query as Mock).mockResolvedValueOnce({
        rows: [{ t0_expiresAt: pastDate }],
        rowCount: 1,
      });
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeTtl({ id: "abc-123" } as any);

      expect(result).toBe(0);
    });
  });

  describe("executeFind", () => {
    test("should find and return hydrated entities", async () => {
      const { client } = createMockClient();
      (client.query as Mock).mockResolvedValueOnce({
        rows: [
          {
            t0_id: "1",
            t0_name: "Alice",
            t0_email: "alice@example.com",
            t0_version: 1,
            t0_deletedAt: null,
            t0_expiresAt: null,
          },
          {
            t0_id: "2",
            t0_name: "Bob",
            t0_email: "bob@example.com",
            t0_version: 1,
            t0_deletedAt: null,
            t0_expiresAt: null,
          },
        ],
        rowCount: 2,
      });
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeFind({}, { limit: 10 });

      expect(result).toHaveLength(2);
    });
  });

  describe("executeCount", () => {
    test("should return count", async () => {
      const { client } = createMockClient([{ count: "42" }]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeCount({}, {});

      expect(result).toBe(42);
    });
  });

  describe("executeExists", () => {
    test("should return true when exists", async () => {
      const { client } = createMockClient([{ exists: true }]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeExists({ id: "abc-123" } as any);

      expect(result).toBe(true);
    });

    test("should return false when not exists", async () => {
      const { client } = createMockClient([{ exists: false }]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeExists({ id: "abc-123" } as any);

      expect(result).toBe(false);
    });
  });

  describe("executeIncrement", () => {
    test("should execute increment", async () => {
      const numMetadata = {
        ...metadata,
        fields: [...metadata.fields, makeField("score", { type: "integer" })],
      } as unknown as EntityMetadata;
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, numMetadata);
      await executor.executeIncrement({ id: "abc-123" } as any, "score" as any, 5);

      expect(queries[0].sql).toContain("+ $1");
      expect(queries[0].params![0]).toBe(5);
    });
  });

  describe("executeDecrement", () => {
    test("should execute decrement with negated value", async () => {
      const numMetadata = {
        ...metadata,
        fields: [...metadata.fields, makeField("score", { type: "integer" })],
      } as unknown as EntityMetadata;
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, numMetadata);
      await executor.executeDecrement({ id: "abc-123" } as any, "score" as any, 3);

      expect(queries[0].sql).toContain("+ $1");
      expect(queries[0].params![0]).toBe(-3);
    });
  });

  describe("executeInsertBulk", () => {
    test("should insert multiple entities", async () => {
      const { client, queries } = createMockClient([
        {
          id: "1",
          name: "Alice",
          email_address: "a@b.com",
          version: 1,
          deleted_at: null,
          expires_at: null,
        },
        {
          id: "2",
          name: "Bob",
          email_address: "b@b.com",
          version: 1,
          deleted_at: null,
          expires_at: null,
        },
      ]);
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeInsertBulk([
        {
          id: "1",
          name: "Alice",
          email: "a@b.com",
          version: 1,
          deletedAt: null,
          expiresAt: null,
        } as any,
        {
          id: "2",
          name: "Bob",
          email: "b@b.com",
          version: 1,
          deletedAt: null,
          expiresAt: null,
        } as any,
      ]);

      expect(result).toHaveLength(2);
      expect(queries[0].sql).toContain("VALUES");
    });

    test("should return empty array for empty input", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      const result = await executor.executeInsertBulk([]);

      expect(result).toEqual([]);
      expect(queries).toHaveLength(0);
    });
  });

  describe("executeUpdateMany", () => {
    test("should execute criteria-based update", async () => {
      const { client, queries } = createMockClient();
      const executor = new PostgresExecutor(client, metadata);
      await executor.executeUpdateMany(
        { name: "Alice" } as any,
        { email: "new@example.com" } as any,
      );

      expect(queries[0].sql).toContain("UPDATE");
      expect(queries[0].sql).toContain("SET");
    });
  });
});
