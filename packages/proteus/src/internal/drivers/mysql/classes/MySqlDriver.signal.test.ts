/**
 * Unit tests for session-level AbortSignal on MySqlDriver.
 *
 * Focus:
 * - cloneWithGetters stores the signal.
 * - Pre-flight abort throws AbortError without pool.query.
 * - Rewrap ER_QUERY_INTERRUPTED (errno 1317) as AbortError.
 * - KILL QUERY dispatched on abort via throwaway mysql2 connection.
 * - BreakerExecutor passes AbortError through; classifyMysqlError returns
 *   "ignorable" for AbortError.
 * - withTransaction short-circuits on abort between retry attempts.
 */

// ─── Module Mocks ────────────────────────────────────────────────────────────

const { mockPool, mockConn, mockKillConn, createPoolMock, createConnMock } = vi.hoisted(
  () => {
    const conn = {
      query: vi.fn().mockResolvedValue([[], {}]),
      release: vi.fn(),
      threadId: 99,
    };
    const pool = {
      getConnection: vi.fn().mockResolvedValue(conn),
      query: vi.fn().mockResolvedValue([[], {}]),
      end: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
    };
    const killConn = {
      query: vi.fn().mockResolvedValue([[], {}]),
      end: vi.fn().mockResolvedValue(undefined),
    };
    return {
      mockPool: pool,
      mockConn: conn,
      mockKillConn: killConn,
      createPoolMock: vi.fn(() => pool),
      createConnMock: vi.fn(async () => killConn),
    };
  },
);

vi.mock("mysql2/promise", () => ({
  default: { createPool: createPoolMock, createConnection: createConnMock },
  createPool: createPoolMock,
  createConnection: createConnMock,
}));

vi.mock("./MySqlExecutor.js", () => ({
  MySqlExecutor: vi.fn(function () {
    return {};
  }),
}));

vi.mock("./MySqlQueryBuilder.js", () => ({
  MySqlQueryBuilder: vi.fn(function () {
    return { build: vi.fn() };
  }),
}));

vi.mock("./MySqlRepository.js", () => ({
  MySqlRepository: vi.fn(function (opts: any) {
    return { _opts: opts };
  }),
}));

vi.mock("../utils/transaction/begin-transaction.js", () => ({
  beginTransaction: vi.fn(),
}));

vi.mock("../utils/transaction/commit-transaction.js", () => ({
  commitTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/transaction/rollback-transaction.js", () => ({
  rollbackTransaction: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../utils/transaction/is-retryable-transaction-error.js", () => ({
  isRetryableTransactionError: vi.fn().mockReturnValue(true),
}));

vi.mock("./MySqlTransactionContext.js", () => ({
  MySqlTransactionContext: vi.fn(function () {
    return { _isCtx: true };
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import { AbortError } from "@lindorm/errors";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { BreakerExecutor } from "../../../classes/BreakerExecutor.js";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { classifyMysqlError } from "../utils/classify-breaker-error.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { beginTransaction } from "../utils/transaction/begin-transaction.js";
import { MySqlDriver } from "./MySqlDriver.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

class TestEntity implements IEntity {
  [key: string]: any;
  id!: string;
}

const mockMetadata = {
  entity: { name: "TestEntity" },
  fields: [makeField("id")],
  primaryKeys: ["id"],
  relations: [],
  generated: [],
  embeddedLists: [],
  indexes: [],
} as unknown as EntityMetadata;

const createLogger = (): ILogger =>
  ({
    child: vi.fn().mockReturnThis(),
    silly: vi.fn(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as ILogger;

const makeDriver = () => {
  const logger = createLogger();
  const resolveMetadata = vi
    .fn<(t: Constructor<IEntity>) => EntityMetadata>()
    .mockReturnValue(mockMetadata);
  const driver = new MySqlDriver(
    { driver: "mysql" } as any,
    logger,
    null,
    resolveMetadata,
  );
  (driver as any).pool = mockPool;
  return { driver, logger, resolveMetadata };
};

const withSession = (driver: MySqlDriver, signal: AbortSignal | undefined): MySqlDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPool.getConnection.mockResolvedValue(mockConn);
  mockPool.query.mockResolvedValue([[], {}]);
  mockConn.query.mockResolvedValue([[], {}]);
  mockConn.release.mockReset();
  mockConn.threadId = 99;
  mockKillConn.query.mockResolvedValue([[], {}]);
  mockKillConn.end.mockResolvedValue(undefined);
  createConnMock.mockResolvedValue(mockKillConn);
});

describe("MySqlDriver (no signal — fast path)", () => {
  test("createRepository routes queries through pool.query, never getConnection", async () => {
    const { driver } = makeDriver();
    const session = withSession(driver, undefined);

    const client = (session as any).createMysqlClientFromPool(mockPool);
    await client.query("SELECT 1");

    expect(mockPool.query).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(mockPool.getConnection).not.toHaveBeenCalled();
  });

  test("withSignal path acquires a fresh PoolConnection per query", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );
    await client.query("SELECT 1");

    expect(mockPool.getConnection).toHaveBeenCalledTimes(1);
    expect(mockConn.query).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(mockConn.release).toHaveBeenCalledTimes(1);
  });
});

describe("pre-flight abort", () => {
  test("throws AbortError without acquiring the pool when already aborted", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = withSession(driver, controller.signal);

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toBeInstanceOf(AbortError);
    expect(mockPool.getConnection).not.toHaveBeenCalled();
  });

  test("AbortError carries the signal reason", async () => {
    const { driver } = makeDriver();
    const reason = { kind: "client-disconnect", requestId: "rq-1" };
    const controller = new AbortController();
    controller.abort(reason);
    const session = withSession(driver, controller.signal);

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    try {
      await client.query("SELECT 1");
      throw new Error("unreachable");
    } catch (err) {
      expect(err).toBeInstanceOf(AbortError);
      expect((err as AbortError).reason).toBe(reason);
    }
  });
});

describe("abort listener lifecycle", () => {
  test("removes abort listener in finally on success", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );
    await client.query("SELECT 1");

    expect(addSpy).toHaveBeenCalledWith("abort", expect.any(Function), { once: true });
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
  });

  test("removes abort listener in finally on error", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    mockConn.query.mockRejectedValueOnce(new Error("db down"));
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toThrow("db down");
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(mockConn.release).toHaveBeenCalled();
  });
});

describe("ER_QUERY_INTERRUPTED (errno 1317)", () => {
  test("rewraps errno 1317 as AbortError carrying the original mysql error", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const mysqlErr: any = Object.assign(new Error("Query execution was interrupted"), {
      errno: 1317,
      code: "ER_QUERY_INTERRUPTED",
    });
    mockConn.query.mockRejectedValueOnce(mysqlErr);

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT SLEEP(5)")).rejects.toBeInstanceOf(AbortError);
  });

  test("rewraps any rejection as AbortError when signal.aborted is true", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    mockConn.query.mockImplementationOnce(async () => {
      controller.abort({ kind: "manual", message: "abort during query" });
      throw new Error("Connection lost");
    });

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toBeInstanceOf(AbortError);
  });

  test("non-1317 errors are passed through unchanged when signal is not aborted", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const dbErr: any = Object.assign(new Error("duplicate entry"), { errno: 1062 });
    mockConn.query.mockRejectedValueOnce(dbErr);

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("INSERT ...")).rejects.toBe(dbErr);
  });
});

describe("tx-scoped client (createMysqlClient) with signal", () => {
  test("post-success signal.aborted check rewraps user query as AbortError", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();

    // Simulate mysql quirk: KILL QUERY of SELECT SLEEP returns a "successful"
    // row. We abort mid-query so the success resolves after the abort fires.
    mockConn.query.mockImplementationOnce(async () => {
      controller.abort({ kind: "client-disconnect" });
      return [[{ "SLEEP(5)": 1 }], {}];
    });

    const client = (driver as any).createMysqlClient(mockConn, controller.signal);

    await expect(client.query("SELECT SLEEP(5)")).rejects.toBeInstanceOf(AbortError);
  });

  test("post-success check exempts ROLLBACK so the pool is not poisoned", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });

    mockConn.query.mockResolvedValueOnce([[], {}]);

    const client = (driver as any).createMysqlClient(mockConn, controller.signal);

    // ROLLBACK must succeed even though signal is aborted — otherwise the
    // caller's cleanup path would leave the connection in aborted-tx state.
    await expect(client.query("ROLLBACK")).resolves.toBeDefined();
  });

  test("post-success check exempts COMMIT", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });

    mockConn.query.mockResolvedValueOnce([[], {}]);

    const client = (driver as any).createMysqlClient(mockConn, controller.signal);

    await expect(client.query("COMMIT")).resolves.toBeDefined();
  });

  test("post-success check exempts START TRANSACTION and SAVEPOINT variants", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });

    mockConn.query.mockResolvedValue([[], {}]);

    const client = (driver as any).createMysqlClient(mockConn, controller.signal);

    await expect(client.query("START TRANSACTION")).resolves.toBeDefined();
    await expect(client.query("SAVEPOINT `sp_1`")).resolves.toBeDefined();
    await expect(client.query("RELEASE SAVEPOINT `sp_1`")).resolves.toBeDefined();
    await expect(client.query("ROLLBACK TO SAVEPOINT `sp_1`")).resolves.toBeDefined();
    await expect(
      client.query("SET TRANSACTION ISOLATION LEVEL READ COMMITTED"),
    ).resolves.toBeDefined();
  });

  test("rewraps ER_QUERY_INTERRUPTED on user query inside tx as AbortError", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();

    const mysqlErr: any = Object.assign(new Error("Query execution was interrupted"), {
      errno: 1317,
      code: "ER_QUERY_INTERRUPTED",
    });
    mockConn.query.mockRejectedValueOnce(mysqlErr);

    const client = (driver as any).createMysqlClient(mockConn, controller.signal);

    await expect(client.query("SELECT SLEEP(5)")).rejects.toBeInstanceOf(AbortError);
  });

  test("non-signal tx path does not re-check signal.aborted", async () => {
    const { driver } = makeDriver();

    mockConn.query.mockResolvedValueOnce([[{ n: 1 }], {}]);
    const client = (driver as any).createMysqlClient(mockConn);

    const result = await client.query("SELECT 1 AS n");
    expect(result.rows[0]).toEqual({ n: 1 });
  });
});

describe("KILL QUERY dispatch", () => {
  test("aborting during a query issues KILL QUERY on a throwaway connection", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    let queryResolve!: (v: any) => void;
    mockConn.query.mockReturnValueOnce(
      new Promise((resolve) => {
        queryResolve = resolve;
      }),
    );

    const client = (session as any).createMysqlClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );
    const pending = client
      .query("SELECT SLEEP(5)")
      .then(() => ({ ok: true as const }))
      .catch((err: unknown) => ({ ok: false as const, err }));

    await Promise.resolve();
    controller.abort({ kind: "client-disconnect" });
    // Let the abort listener schedule the KILL QUERY before resolving.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();
    queryResolve([[], {}]);
    const result = await pending;
    // Final flush to let the best-effort cancel finish.
    for (let i = 0; i < 10; i += 1) await Promise.resolve();

    // mysql may return a success result after KILL QUERY — the signal-aware
    // path rewraps this as AbortError so the caller gets the cancellation
    // semantics regardless of how mysql surfaced the kill.
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.err).toBeInstanceOf(AbortError);
    expect(createConnMock).toHaveBeenCalledTimes(1);
    expect(mockKillConn.query).toHaveBeenCalledWith("KILL QUERY ?", [99]);
    expect(mockKillConn.end).toHaveBeenCalledTimes(1);
  });
});

describe("attachConnectionAbortListener", () => {
  test("issues KILL QUERY when signal fires", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const dispose = (driver as any).attachConnectionAbortListener(
      mockConn,
      controller.signal,
    );

    controller.abort({ kind: "manual" });
    for (let i = 0; i < 50; i += 1) await Promise.resolve();

    expect(createConnMock).toHaveBeenCalledTimes(1);
    expect(mockKillConn.query).toHaveBeenCalledWith("KILL QUERY ?", [99]);
    dispose();
  });

  test("dispose removes listener so a later abort does not fire KILL QUERY", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const dispose = (driver as any).attachConnectionAbortListener(
      mockConn,
      controller.signal,
    );

    dispose();
    controller.abort({ kind: "manual" });
    await Promise.resolve();

    expect(createConnMock).not.toHaveBeenCalled();
  });
});

describe("BreakerExecutor + AbortError", () => {
  test("AbortError is classified as ignorable (does not trip the breaker)", () => {
    const err = new AbortError("cancelled", { reason: { kind: "manual" } });
    expect(classifyMysqlError(err)).toBe("ignorable");
  });

  test("BreakerExecutor.run passes AbortError through without recording failure", async () => {
    const breaker = {
      execute: vi.fn().mockImplementation(async (fn: any) => fn()),
    } as any;

    const inner = {
      executeFind: vi
        .fn()
        .mockRejectedValue(new AbortError("cancelled", { reason: { kind: "manual" } })),
    } as any;

    const wrapper = new BreakerExecutor(inner, breaker);

    await expect(wrapper.executeFind({} as any, {} as any)).rejects.toBeInstanceOf(
      AbortError,
    );
    expect(breaker.execute).toHaveBeenCalled();
  });
});

describe("withTransaction + abort", () => {
  test("short-circuits with AbortError when signal is aborted before first attempt", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = withSession(driver, controller.signal);

    await expect(session.withTransaction(async () => "never")).rejects.toBeInstanceOf(
      AbortError,
    );
    expect(beginTransaction).not.toHaveBeenCalled();
  });

  test("does not retry after signal is aborted mid-flight", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const handle = {
      client: mockConn,
      connection: mockConn,
      release: vi.fn(),
      state: "active" as const,
      savepointCounter: 0,
    };
    (beginTransaction as unknown as Mock).mockResolvedValue(handle);

    const callback = vi.fn().mockImplementationOnce(async () => {
      controller.abort({ kind: "client-disconnect" });
      throw Object.assign(new Error("deadlock"), { errno: 1213 });
    });

    await expect(
      session.withTransaction(callback, {
        retry: { maxRetries: 3, initialDelayMs: 0 } as any,
      }),
    ).rejects.toBeTruthy();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
