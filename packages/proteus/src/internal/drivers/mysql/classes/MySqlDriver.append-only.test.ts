/**
 * The @AppendOnly trigger DDL is not best-effort on MySQL either.
 *
 * The repository guard refuses an update/delete that goes THROUGH proteus.
 * These triggers exist for the writes that do not — raw SQL, another service,
 * a migration. A failure used to be logged at `warn` while setup reported
 * success, so a deployment believed a table was immutable while nothing
 * enforced it. Setup must fail instead, naming the table.
 */

// ─── Module Mocks ────────────────────────────────────────────────────────────

const { mockPool, mockConn, createPoolMock } = vi.hoisted(() => {
  const conn = {
    query: vi.fn(),
    release: vi.fn(),
    threadId: 7,
  };
  const pool = {
    getConnection: vi.fn(async () => conn),
    query: vi.fn(async () => [[], {}]),
    end: vi.fn(async () => undefined),
    on: vi.fn(),
  };
  return { mockPool: pool, mockConn: conn, createPoolMock: vi.fn(() => pool) };
});

vi.mock("mysql2/promise", () => ({
  default: { createPool: createPoolMock },
  createPool: createPoolMock,
}));

vi.mock("./MySqlExecutor.js", () => ({ MySqlExecutor: vi.fn(function () {}) }));
vi.mock("./MySqlQueryBuilder.js", () => ({ MySqlQueryBuilder: vi.fn(function () {}) }));
vi.mock("./MySqlRepository.js", () => ({ MySqlRepository: vi.fn(function () {}) }));

vi.mock("../utils/sync/project-desired-schema-mysql.js", () => ({
  projectDesiredSchemaMysql: vi.fn().mockReturnValue({ tables: [] }),
}));

vi.mock("../utils/sync/introspect-schema.js", () => ({
  introspectSchema: vi.fn().mockResolvedValue({ tables: [] }),
}));

vi.mock("../utils/sync/diff-schema.js", () => ({
  diffSchema: vi.fn().mockReturnValue({ operations: [] }),
}));

const mockSyncExecute = vi.fn().mockResolvedValue({ statementsExecuted: 0 });
vi.mock("../utils/sync/execute-sync-plan.js", () => ({
  SyncPlanExecutor: vi.fn(function () {
    return { execute: mockSyncExecute };
  }),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { beforeEach, describe, expect, test, vi } from "vitest";
import type { IEntity } from "../../../../interfaces/index.js";
import type { EntityMetadata } from "../../../entity/types/metadata.js";
import { makeField } from "../../../__fixtures__/make-field.js";
import { MySqlSyncError } from "../errors/MySqlSyncError.js";
import { MySqlDriver } from "./MySqlDriver.js";

// ─── Fixtures ─────────────────────────────────────────────────────────────────

class TestEntity implements IEntity {
  [key: string]: any;
  id!: string;
}

const makeMetadata = (appendOnly: boolean): EntityMetadata =>
  ({
    entity: { name: "Ledger", namespace: null },
    fields: [makeField("id")],
    primaryKeys: ["id"],
    relations: [],
    generated: [],
    embeddedLists: [],
    indexes: [],
    appendOnly,
  }) as unknown as EntityMetadata;

const createLogger = (): ILogger =>
  ({
    child: vi.fn().mockReturnThis(),
    silly: vi.fn(),
    debug: vi.fn(),
    verbose: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as ILogger;

const makeDriver = (appendOnly: boolean): MySqlDriver => {
  const resolveMetadata = vi
    .fn<(t: Constructor<IEntity>) => EntityMetadata>()
    .mockReturnValue(makeMetadata(appendOnly));
  const driver = new MySqlDriver(
    { driver: "mysql", synchronize: true } as any,
    createLogger(),
    null,
    resolveMetadata,
  );
  (driver as any).pool = mockPool;
  return driver;
};

/**
 * The sync path acquires a session advisory lock before it does anything, so
 * GET_LOCK must answer 1. `failTriggerDdl` then rejects only the trigger DDL,
 * leaving the lock handling intact.
 */
const respondToQueries = (failTriggers: boolean): void => {
  mockConn.query.mockImplementation(async (sql: string) => {
    if (sql.includes("GET_LOCK")) return [[{ lock_result: 1 }], {}];
    if (failTriggers && sql.includes("TRIGGER")) {
      throw new Error("TRIGGER command denied to user 'app'@'%'");
    }
    return [[], {}];
  });
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("MySqlDriver append-only triggers", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPool.getConnection.mockImplementation(async () => mockConn);
    mockSyncExecute.mockResolvedValue({ statementsExecuted: 0 });
  });

  test("applies the trigger DDL after a successful sync", async () => {
    const driver = makeDriver(true);
    respondToQueries(false);

    await driver.setup([TestEntity]);

    const created = mockConn.query.mock.calls
      .map((call) => String(call[0]))
      .filter((sql) => sql.includes("CREATE TRIGGER"));

    expect(created).toHaveLength(2);
  });

  test("setup rejects, naming the table, when the trigger DDL fails", async () => {
    const driver = makeDriver(true);
    respondToQueries(true);

    await expect(driver.setup([TestEntity])).rejects.toThrow(MySqlSyncError);
    await expect(driver.setup([TestEntity])).rejects.toThrow(/Ledger/);
  });

  test("the rejection carries the table, the driver and the underlying failure", async () => {
    const driver = makeDriver(true);
    respondToQueries(true);

    const error = (await driver
      .setup([TestEntity])
      .catch((e: unknown) => e)) as MySqlSyncError;

    expect(error.code).toBe("append_only_trigger_failed");
    expect(error.data).toEqual({ table: "`Ledger`", driver: "mysql" });
    expect(error.details).toContain("TRIGGER command denied");
  });

  test("the sync advisory lock is still released when the trigger DDL fails", async () => {
    const driver = makeDriver(true);
    respondToQueries(true);

    await driver.setup([TestEntity]).catch(() => undefined);

    const released = mockConn.query.mock.calls
      .map((call) => String(call[0]))
      .filter((sql) => sql.includes("RELEASE_LOCK"));

    expect(released).toHaveLength(1);
    expect(mockConn.release).toHaveBeenCalled();
  });

  test("a non-append-only entity does not fail setup when the drop DDL fails", async () => {
    const driver = makeDriver(false);
    respondToQueries(true);

    // Dropping a leftover trigger stays best-effort: the table may not exist
    // yet on a first sync, and a trigger that survives only makes the table
    // stricter than asked, never looser.
    await expect(driver.setup([TestEntity])).resolves.toBeUndefined();
  });
});
