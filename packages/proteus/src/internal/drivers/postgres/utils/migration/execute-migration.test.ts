import { PostgresMigrationError } from "../../errors/PostgresMigrationError";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type { MigrationInterface, MigrationQueryRunner } from "../../types/migration";
import { executeMigrationUp, executeMigrationDown } from "./execute-migration";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// Mock migration-table
vi.mock("./migration-table", async () => ({
  ensureMigrationTable: vi.fn(),
  insertMigrationRecord: vi.fn(),
  deleteMigrationRecord: vi.fn(),
  markMigrationFinished: vi.fn(),
  markMigrationRolledBack: vi.fn(),
}));

import {
  ensureMigrationTable,
  insertMigrationRecord,
  deleteMigrationRecord,
  markMigrationFinished,
  markMigrationRolledBack,
} from "./migration-table";

const mockEnsureTable = ensureMigrationTable as MockedFunction<
  typeof ensureMigrationTable
>;
const mockInsertRecord = insertMigrationRecord as MockedFunction<
  typeof insertMigrationRecord
>;
const mockDeleteRecord = deleteMigrationRecord as MockedFunction<
  typeof deleteMigrationRecord
>;
const mockMarkFinished = markMigrationFinished as MockedFunction<
  typeof markMigrationFinished
>;
const mockMarkRolledBack = markMigrationRolledBack as MockedFunction<
  typeof markMigrationRolledBack
>;

const mockClient: PostgresQueryClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const makeMigration = (
  overrides: Partial<MigrationInterface> = {},
): MigrationInterface => ({
  id: "uuid-001",
  ts: "2026-02-20T09:00:00.000Z",
  up: vi.fn(),
  down: vi.fn(),
  ...overrides,
});

beforeEach(() => {
  vi.clearAllMocks();
});

describe("executeMigrationUp", () => {
  it("should execute up(), insert record, and mark finished", async () => {
    const migration = makeMigration();

    const result = await executeMigrationUp(mockClient, migration, {
      name: "20260220090000-init",
      checksum: "abc123",
    });

    expect(mockEnsureTable).toHaveBeenCalledWith(mockClient, undefined);
    expect(mockInsertRecord).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        id: "uuid-001",
        name: "20260220090000-init",
        checksum: "abc123",
      }),
      undefined,
    );
    expect(migration.up).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction: expect.any(Function),
        query: expect.any(Function),
      }),
    );
    expect(mockMarkFinished).toHaveBeenCalledWith(mockClient, "uuid-001", undefined);
    expect(result.name).toBe("20260220090000-init");
    expect(typeof result.durationMs).toBe("number");
  });

  it("should throw PostgresMigrationError when up() fails", async () => {
    const migration = makeMigration({
      up: vi.fn().mockRejectedValue(new Error("SQL syntax error")),
    });

    await expect(
      executeMigrationUp(mockClient, migration, { name: "test", checksum: "x" }),
    ).rejects.toThrow("Migration up() failed");
  });

  it("should delete orphaned record when up() fails", async () => {
    const migration = makeMigration({
      up: vi.fn().mockRejectedValue(new Error("SQL syntax error")),
    });

    await expect(
      executeMigrationUp(mockClient, migration, { name: "test", checksum: "x" }),
    ).rejects.toThrow();

    expect(mockDeleteRecord).toHaveBeenCalledWith(mockClient, "uuid-001", undefined);
  });

  it("should pass table options through", async () => {
    const opts = { schema: "custom", table: "my_migrations" };

    await executeMigrationUp(
      mockClient,
      makeMigration(),
      { name: "test", checksum: "x" },
      opts,
    );

    expect(mockEnsureTable).toHaveBeenCalledWith(mockClient, opts);
    expect(mockInsertRecord).toHaveBeenCalledWith(mockClient, expect.anything(), opts);
    expect(mockMarkFinished).toHaveBeenCalledWith(mockClient, "uuid-001", opts);
  });

  it("should create a runner that supports transaction and query", async () => {
    let capturedRunner: MigrationQueryRunner | null = null;
    const migration = makeMigration({
      up: vi.fn(async (runner) => {
        capturedRunner = runner;
      }),
    });

    await executeMigrationUp(mockClient, migration, { name: "test", checksum: "x" });

    expect(capturedRunner).not.toBeNull();
    expect(typeof capturedRunner!.transaction).toBe("function");
    expect(typeof capturedRunner!.query).toBe("function");
  });

  it("should wrap runner.transaction in BEGIN/COMMIT", async () => {
    const queries: Array<string> = [];
    const txClient: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [], rowCount: 0 };
      }),
    };

    const migration = makeMigration({
      up: vi.fn(async (runner: any) => {
        await runner.transaction(async (ctx: any) => {
          await ctx.query("INSERT INTO foo VALUES (1)");
        });
      }),
    });

    await executeMigrationUp(txClient, migration, { name: "test", checksum: "x" });

    expect(queries).toContain("BEGIN");
    expect(queries).toContain("INSERT INTO foo VALUES (1)");
    expect(queries).toContain("COMMIT");
  });

  it("should ROLLBACK on transaction error", async () => {
    const queries: Array<string> = [];
    const txClient: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        return { rows: [], rowCount: 0 };
      }),
    };

    const migration = makeMigration({
      up: vi.fn(async (runner) => {
        await runner.transaction(async () => {
          throw new Error("boom");
        });
      }),
    });

    await expect(
      executeMigrationUp(txClient, migration, { name: "test", checksum: "x" }),
    ).rejects.toThrow("Migration up() failed");

    expect(queries).toContain("BEGIN");
    expect(queries).toContain("ROLLBACK");
    expect(queries).not.toContain("COMMIT");
  });

  // P1-D: when cleanup (deleteMigrationRecord) itself throws, the original migration error still wins
  it("should preserve the original PostgresMigrationError when deleteMigrationRecord also throws during cleanup", async () => {
    const upError = new Error("SQL syntax error");
    const migration = makeMigration({
      up: vi.fn().mockRejectedValue(upError),
    });
    mockDeleteRecord.mockRejectedValue(new Error("cleanup DB connection lost"));

    const thrown = await executeMigrationUp(mockClient, migration, {
      name: "test",
      checksum: "x",
    }).catch((e: unknown) => e);

    // Must be a PostgresMigrationError wrapping the up() failure — not the cleanup error
    expect(thrown).toBeInstanceOf(PostgresMigrationError);
    expect((thrown as PostgresMigrationError).message).toMatchSnapshot();
    // The cleanup error message must not appear on the thrown error
    expect((thrown as PostgresMigrationError).message).not.toContain(
      "cleanup DB connection lost",
    );
    // The original up() error message must be recorded in the error chain
    expect((thrown as PostgresMigrationError).errors).toContain(
      `Error: ${upError.message}`,
    );
  });
});

describe("executeMigrationDown", () => {
  it("should execute down() and mark rolled back", async () => {
    const migration = makeMigration();

    const result = await executeMigrationDown(mockClient, migration, {
      name: "20260220090000-init",
    });

    expect(mockEnsureTable).toHaveBeenCalledWith(mockClient, undefined);
    expect(migration.down).toHaveBeenCalledWith(
      expect.objectContaining({
        transaction: expect.any(Function),
        query: expect.any(Function),
      }),
    );
    expect(mockMarkRolledBack).toHaveBeenCalledWith(mockClient, "uuid-001", undefined);
    expect(result.name).toBe("20260220090000-init");
    expect(typeof result.durationMs).toBe("number");
  });

  it("should throw PostgresMigrationError when down() fails", async () => {
    const migration = makeMigration({
      down: vi.fn().mockRejectedValue(new Error("rollback error")),
    });

    await expect(
      executeMigrationDown(mockClient, migration, { name: "test" }),
    ).rejects.toThrow("Migration down() failed");
  });
});
