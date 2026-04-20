import { PostgresTransactionError } from "../../errors/PostgresTransactionError";
import { beginTransaction } from "./begin-transaction";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockPoolClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
  release: vi.fn(),
};

const mockPool = {
  connect: vi.fn().mockResolvedValue(mockPoolClient),
} as any;

const mockCreatePgClient = vi.fn((poolClient: any) => ({
  query: vi.fn(async (sql: string, params?: Array<unknown>) => {
    return poolClient.query(sql, params);
  }),
}));

beforeEach(() => {
  vi.clearAllMocks();
});

describe("beginTransaction", () => {
  it("should check out a pool client and issue BEGIN", async () => {
    const handle = await beginTransaction(mockPool, mockCreatePgClient);

    expect(mockPool.connect).toHaveBeenCalled();
    expect(mockCreatePgClient).toHaveBeenCalledWith(mockPoolClient);
    expect(mockPoolClient.query).toHaveBeenCalledWith("BEGIN", undefined);
    expect(handle.state).toBe("active");
    expect(handle.savepointCounter).toBe(0);
  });

  it("should issue BEGIN with isolation level when provided", async () => {
    await beginTransaction(mockPool, mockCreatePgClient, "SERIALIZABLE");

    expect(mockPoolClient.query).toHaveBeenCalledWith(
      "BEGIN ISOLATION LEVEL SERIALIZABLE",
      undefined,
    );
  });

  it("should issue BEGIN with REPEATABLE READ isolation", async () => {
    await beginTransaction(mockPool, mockCreatePgClient, "REPEATABLE READ");

    expect(mockPoolClient.query).toHaveBeenCalledWith(
      "BEGIN ISOLATION LEVEL REPEATABLE READ",
      undefined,
    );
  });

  it("should release pool client on failure", async () => {
    mockPoolClient.query.mockRejectedValueOnce(new Error("connection lost"));

    await expect(beginTransaction(mockPool, mockCreatePgClient)).rejects.toThrow(
      PostgresTransactionError,
    );

    expect(mockPoolClient.release).toHaveBeenCalled();
  });

  it("should return a handle with a release function", async () => {
    const handle = await beginTransaction(mockPool, mockCreatePgClient);

    handle.release();

    expect(mockPoolClient.release).toHaveBeenCalled();
  });

  it("should throw PostgresTransactionError for invalid isolation level", async () => {
    await expect(
      beginTransaction(mockPool, mockCreatePgClient, "DROP TABLE users" as any),
    ).rejects.toThrow(PostgresTransactionError);
  });

  it("should not check out a pool client when isolation level is invalid", async () => {
    try {
      await beginTransaction(mockPool, mockCreatePgClient, "INVALID" as any);
    } catch {}
    // pool.connect should NOT have been called since validation happens first
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  it("should wrap pool.connect() failure in PostgresTransactionError", async () => {
    const connectError = new Error("connection pool exhausted");
    mockPool.connect.mockRejectedValueOnce(connectError);

    const thrown = await beginTransaction(mockPool, mockCreatePgClient).catch(
      (e: unknown) => e,
    );

    expect(thrown).toBeInstanceOf(PostgresTransactionError);
    expect((thrown as PostgresTransactionError).message).toBe(
      "Failed to acquire pool connection",
    );
    // LindormError absorbs the wrapped error's identity into the errors array
    expect((thrown as PostgresTransactionError).errors).toMatchSnapshot();
  });
});
