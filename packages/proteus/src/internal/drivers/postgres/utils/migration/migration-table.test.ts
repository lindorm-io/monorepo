import { PostgresMigrationError } from "../../errors/PostgresMigrationError";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import {
  ensureMigrationTable,
  getAppliedMigrations,
  getAllMigrationRecords,
  insertMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table";

const createMockClient = (
  defaultRowCount = 0,
): PostgresQueryClient & {
  calls: Array<{ sql: string; params?: Array<unknown> }>;
} => {
  const calls: Array<{ sql: string; params?: Array<unknown> }> = [];
  return {
    calls,
    query: jest.fn(async (sql: string, params?: Array<unknown>) => {
      calls.push({ sql, params });
      return { rows: [], rowCount: defaultRowCount };
    }),
  };
};

describe("ensureMigrationTable", () => {
  it("should create schema and table with default names", async () => {
    const client = createMockClient();
    await ensureMigrationTable(client);

    expect(client.calls).toHaveLength(2);
    expect(client.calls[0].sql).toMatchSnapshot();
    expect(client.calls[1].sql).toMatchSnapshot();
  });

  it("should use custom schema and table names", async () => {
    const client = createMockClient();
    await ensureMigrationTable(client, { schema: "app", table: "migrations" });

    expect(client.calls[0].sql).toContain('"app"');
    expect(client.calls[1].sql).toContain('"app"."migrations"');
  });
});

describe("getAppliedMigrations", () => {
  it("should query applied migrations and map rows to records", async () => {
    const now = new Date("2026-02-20T10:00:00Z");
    const client = createMockClient();
    (client.query as jest.Mock).mockResolvedValueOnce({
      rows: [
        {
          id: "aaa",
          name: "20260220-init",
          checksum: "abc123",
          created_at: now,
          started_at: now,
          finished_at: now,
          rolled_back_at: null,
        },
      ],
      rowCount: 1,
    });

    const result = await getAppliedMigrations(client);

    expect(result).toHaveLength(1);
    expect(result[0]).toMatchSnapshot();
  });

  it("should filter for finished and not rolled back", async () => {
    const client = createMockClient();
    await getAppliedMigrations(client);

    expect(client.calls[0].sql).toMatchSnapshot();
  });
});

describe("getAllMigrationRecords", () => {
  it("should query all records without WHERE filter", async () => {
    const client = createMockClient();
    await getAllMigrationRecords(client);

    expect(client.calls[0].sql).toMatchSnapshot();
    expect(client.calls[0].sql).not.toContain("WHERE");
  });

  it("should use custom table options", async () => {
    const client = createMockClient();
    await getAllMigrationRecords(client, { schema: "custom", table: "migr" });

    expect(client.calls[0].sql).toContain('"custom"."migr"');
  });
});

describe("insertMigrationRecord", () => {
  it("should upsert with parameterized values", async () => {
    const client = createMockClient();
    const createdAt = new Date("2026-02-20T09:00:00Z");
    const startedAt = new Date("2026-02-20T09:00:01Z");

    await insertMigrationRecord(client, {
      id: "uuid-1",
      name: "20260220-add-users",
      checksum: "hash123",
      createdAt,
      startedAt,
    });

    expect(client.calls[0].sql).toMatchSnapshot();
    expect(client.calls[0].params).toEqual([
      "uuid-1",
      "20260220-add-users",
      "hash123",
      createdAt,
      startedAt,
    ]);
  });

  it('should include "id" = EXCLUDED."id" in the ON CONFLICT update set', async () => {
    const client = createMockClient();
    const now = new Date();
    await insertMigrationRecord(client, {
      id: "uuid-2",
      name: "20260220-re-run",
      checksum: "hash456",
      createdAt: now,
      startedAt: now,
    });

    expect(client.calls[0].sql).toContain('"id" = EXCLUDED."id"');
  });

  it("should use custom table options", async () => {
    const client = createMockClient();
    const now = new Date();
    await insertMigrationRecord(
      client,
      { id: "x", name: "y", checksum: "z", createdAt: now, startedAt: now },
      { schema: "custom", table: "migr" },
    );

    expect(client.calls[0].sql).toContain('"custom"."migr"');
  });
});

describe("markMigrationFinished", () => {
  it("should update finished_at by id", async () => {
    const client = createMockClient(1);
    await markMigrationFinished(client, "uuid-1");

    expect(client.calls[0].sql).toMatchSnapshot();
    expect(client.calls[0].params).toEqual(["uuid-1"]);
  });

  it("should throw when no record matches", async () => {
    const client = createMockClient(0);
    await expect(markMigrationFinished(client, "missing")).rejects.toThrow(
      PostgresMigrationError,
    );
  });
});

describe("markMigrationRolledBack", () => {
  it("should update rolled_back_at and coalesce finished_at", async () => {
    const client = createMockClient(1);
    await markMigrationRolledBack(client, "uuid-1");

    expect(client.calls[0].sql).toMatchSnapshot();
    expect(client.calls[0].params).toEqual(["uuid-1"]);
  });

  it("should throw when no record matches", async () => {
    const client = createMockClient(0);
    await expect(markMigrationRolledBack(client, "missing")).rejects.toThrow(
      PostgresMigrationError,
    );
  });
});
