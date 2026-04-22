/**
 * Unit tests for the Tier 3 cancellation path on PostgresDriver.
 *
 * Focus:
 * - Session signal routes queries through the acquire-per-query path.
 * - Pre-flight abort throws AbortError without any pool.connect() call.
 * - Rejections with code "57014" and rejections during signal.aborted are
 *   rewrapped as AbortError with signal.reason attached.
 * - Listener lifecycle — registered on abort once per query, removed in finally.
 * - Non-signal sessions keep hitting the unchanged pool.query fast path.
 * - Breaker wrapper passes AbortError through without incrementing failures.
 * - withTransaction short-circuits when the signal is aborted between attempts.
 */

// ─── Module Mocks ────────────────────────────────────────────────────────────

const { mockPool, mockClient, mockCancelClient, PoolMock, ClientMock } = vi.hoisted(
  () => {
    const client = {
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      release: vi.fn(),
      processID: 4242,
    };
    const pool = {
      connect: vi.fn().mockResolvedValue(client),
      end: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      on: vi.fn(),
    };
    const cancelClient = {
      connect: vi.fn().mockResolvedValue(undefined),
      query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
      end: vi.fn().mockResolvedValue(undefined),
    };
    return {
      mockPool: pool,
      mockClient: client,
      mockCancelClient: cancelClient,
      PoolMock: vi.fn(function () {
        return pool;
      }),
      ClientMock: vi.fn(function () {
        return cancelClient;
      }),
    };
  },
);

vi.mock("pg", () => ({
  Pool: PoolMock,
  Client: ClientMock,
}));

vi.mock("./PostgresExecutor.js", () => ({
  PostgresExecutor: vi.fn(function () {
    return {};
  }),
}));

vi.mock("./PostgresQueryBuilder.js", () => ({
  PostgresQueryBuilder: vi.fn(function () {
    return { build: vi.fn() };
  }),
}));

vi.mock("./PostgresRepository.js", () => ({
  PostgresRepository: vi.fn(function (opts: any) {
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

vi.mock("../utils/transaction/with-retry.js", async () => {
  const actual = await vi.importActual<any>("../utils/transaction/with-retry.js");
  return actual;
});

vi.mock("./TransactionContext.js", () => ({
  TransactionContext: vi.fn(function () {
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
import { classifyPostgresError } from "../utils/classify-breaker-error.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { beginTransaction } from "../utils/transaction/begin-transaction.js";
import { PostgresDriver } from "./PostgresDriver.js";

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
  const driver = new PostgresDriver(
    { driver: "postgres" } as any,
    logger,
    null,
    resolveMetadata,
  );
  // Inject the mocked pool directly — bypass doConnect() so we don't race on it.
  (driver as any).pool = mockPool;
  return { driver, logger, resolveMetadata };
};

const withSession = (
  driver: PostgresDriver,
  signal: AbortSignal | undefined,
): PostgresDriver =>
  driver.cloneWithGetters(
    () => new Map(),
    async (): Promise<void> => {},
    signal,
  );

// ─── Tests ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.clearAllMocks();
  mockPool.connect.mockResolvedValue(mockClient);
  mockPool.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockClient.release.mockReset();
  mockClient.processID = 4242;
  mockCancelClient.connect.mockResolvedValue(undefined);
  mockCancelClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
  mockCancelClient.end.mockResolvedValue(undefined);
});

// ─── Fast-path (no signal) ────────────────────────────────────────────────────

describe("PostgresDriver (no signal — fast path)", () => {
  test("createRepository routes queries through pool.query, never pool.connect", async () => {
    const { driver } = makeDriver();
    const session = withSession(driver, undefined);
    session.createRepository(TestEntity);

    // The PostgresQueryClient returned by createPgClientFromPool calls
    // pool.query directly. Running a query via the client verifies that
    // pool.connect was NOT invoked on this path.
    const client = (session as any).createPgClientFromPool(mockPool);
    await client.query("SELECT 1");

    expect(mockPool.query).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  test("withSignal path acquires a fresh PoolClient per query", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );
    await client.query("SELECT 1");

    expect(mockPool.connect).toHaveBeenCalledTimes(1);
    expect(mockClient.query).toHaveBeenCalledWith("SELECT 1", undefined);
    expect(mockClient.release).toHaveBeenCalledTimes(1);
  });
});

// ─── Pre-flight abort ─────────────────────────────────────────────────────────

describe("pre-flight abort", () => {
  test("throws AbortError without acquiring the pool when already aborted", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    controller.abort({ kind: "client-disconnect" });
    const session = withSession(driver, controller.signal);

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toBeInstanceOf(AbortError);
    expect(mockPool.connect).not.toHaveBeenCalled();
  });

  test("AbortError carries the signal reason", async () => {
    const { driver } = makeDriver();
    const reason = { kind: "client-disconnect", requestId: "rq-1" };
    const controller = new AbortController();
    controller.abort(reason);
    const session = withSession(driver, controller.signal);

    const client = (session as any).createPgClientFromPoolWithSignal(
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

// ─── Listener lifecycle ──────────────────────────────────────────────────────

describe("abort listener lifecycle", () => {
  test("removes abort listener in finally on success", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const addSpy = vi.spyOn(controller.signal, "addEventListener");
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const client = (session as any).createPgClientFromPoolWithSignal(
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

    mockClient.query.mockRejectedValueOnce(new Error("db down"));
    const removeSpy = vi.spyOn(controller.signal, "removeEventListener");

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toThrow("db down");
    expect(removeSpy).toHaveBeenCalledWith("abort", expect.any(Function));
    expect(mockClient.release).toHaveBeenCalled();
  });
});

// ─── 57014 rewrap ────────────────────────────────────────────────────────────

describe("pg error code 57014", () => {
  test("rewraps 57014 as AbortError carrying the original pg error", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const pgErr: any = Object.assign(
      new Error("canceling statement due to user request"),
      {
        code: "57014",
      },
    );
    mockClient.query.mockRejectedValueOnce(pgErr);

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    try {
      await client.query("SELECT pg_sleep(5)");
      throw new Error("unreachable");
    } catch (err) {
      expect(err).toBeInstanceOf(AbortError);
      // The original pg error is preserved on errors list via LindormError
      expect((err as AbortError).errors?.[0]).toContain("canceling statement");
    }
  });

  test("rewraps any rejection as AbortError when signal.aborted is true", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    // Arrange: when query runs, abort first, then reject with a generic error.
    mockClient.query.mockImplementationOnce(async () => {
      controller.abort({ kind: "manual", message: "abort during query" });
      throw new Error("Connection terminated unexpectedly");
    });

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("SELECT 1")).rejects.toBeInstanceOf(AbortError);
  });

  test("non-57014 errors are passed through unchanged when signal is not aborted", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    const dbErr: any = Object.assign(new Error("unique violation"), { code: "23505" });
    mockClient.query.mockRejectedValueOnce(dbErr);

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );

    await expect(client.query("INSERT ...")).rejects.toBe(dbErr);
  });
});

// ─── Cancel via pg_cancel_backend ────────────────────────────────────────────

describe("pg_cancel_backend dispatch", () => {
  test("aborting during a query issues pg_cancel_backend on a throwaway Client", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const session = withSession(driver, controller.signal);

    // Resolve the query only after we've aborted. The listener should fire
    // synchronously from controller.abort() and dispatch pg_cancel_backend.
    let queryResolve!: (v: any) => void;
    mockClient.query.mockReturnValueOnce(
      new Promise((resolve) => {
        queryResolve = resolve;
      }),
    );

    const client = (session as any).createPgClientFromPoolWithSignal(
      mockPool,
      controller.signal,
    );
    const pending = client.query("SELECT pg_sleep(5)");

    // Let the microtask that acquires pc run, then abort.
    await Promise.resolve();
    controller.abort({ kind: "client-disconnect" });
    queryResolve({ rows: [], rowCount: 0 });
    await pending;

    expect(ClientMock).toHaveBeenCalledTimes(1);
    expect(mockCancelClient.connect).toHaveBeenCalledTimes(1);
    expect(mockCancelClient.query).toHaveBeenCalledWith(
      "SELECT pg_cancel_backend($1)",
      [4242],
    );
    expect(mockCancelClient.end).toHaveBeenCalledTimes(1);
  });
});

// ─── attachPoolClientAbortListener ────────────────────────────────────────────

describe("attachPoolClientAbortListener", () => {
  test("issues pg_cancel_backend when signal fires", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const dispose = (driver as any).attachPoolClientAbortListener(
      mockClient,
      controller.signal,
    );

    controller.abort({ kind: "manual" });
    await Promise.resolve();
    await Promise.resolve();

    expect(ClientMock).toHaveBeenCalledTimes(1);
    expect(mockCancelClient.query).toHaveBeenCalledWith(
      "SELECT pg_cancel_backend($1)",
      [4242],
    );
    dispose();
  });

  test("dispose removes listener so a later abort does not fire cancel", async () => {
    const { driver } = makeDriver();
    const controller = new AbortController();
    const dispose = (driver as any).attachPoolClientAbortListener(
      mockClient,
      controller.signal,
    );

    dispose();
    controller.abort({ kind: "manual" });
    await Promise.resolve();

    expect(ClientMock).not.toHaveBeenCalled();
  });
});

// ─── Breaker wrapper ──────────────────────────────────────────────────────────

describe("BreakerExecutor + AbortError", () => {
  test("AbortError is classified as ignorable (does not trip the breaker)", () => {
    const err = new AbortError("cancelled", { reason: { kind: "manual" } });
    expect(classifyPostgresError(err)).toBe("ignorable");
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
    // The breaker.execute was called — the inner fn was invoked — but the
    // outer AbortError passthrough preserves error identity.
    expect(breaker.execute).toHaveBeenCalled();
  });
});

// ─── withTransaction retry short-circuit ──────────────────────────────────────

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
      client: mockClient,
      release: vi.fn(),
      state: "active" as const,
      savepointCounter: 0,
    };
    (beginTransaction as unknown as Mock).mockResolvedValue(handle);

    // First attempt: abort before throwing a retryable error. The retry wrapper
    // must NOT dispatch a second attempt.
    const callback = vi.fn().mockImplementationOnce(async () => {
      controller.abort({ kind: "client-disconnect" });
      throw Object.assign(new Error("serialization_failure"), { code: "40001" });
    });

    await expect(
      session.withTransaction(callback, {
        retry: { maxRetries: 3, initialDelayMs: 0 } as any,
      }),
    ).rejects.toBeTruthy();

    expect(callback).toHaveBeenCalledTimes(1);
  });
});
