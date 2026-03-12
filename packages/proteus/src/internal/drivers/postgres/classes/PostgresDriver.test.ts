/**
 * Unit tests for PostgresDriver.
 *
 * The pg Pool is mocked at the module level so no real database is needed.
 * We focus on testing the driver's public interface:
 * - connect() / disconnect() / ping()
 * - createRepository() / createTransactionalRepository()
 * - createExecutor() / createTransactionalExecutor()
 * - createQueryBuilder() / createTransactionalQueryBuilder()
 * - withTransaction() / beginTransaction() / commitTransaction() / rollbackTransaction()
 * - cloneWithGetters()
 * - setup() mutual exclusion guard
 * - getPool() guard (throws when not connected)
 */

// ─── Module Mocks ────────────────────────────────────────────────────────────

jest.mock("pg", () => {
  const mockClient = {
    query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
    release: jest.fn(),
  };
  const mockPool = {
    connect: jest.fn().mockResolvedValue(mockClient),
    end: jest.fn().mockResolvedValue(undefined),
    query: jest.fn().mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 }),
    on: jest.fn(),
    __mockClient: mockClient,
  };
  return {
    Pool: jest.fn().mockImplementation(() => mockPool),
    __mockPool: mockPool,
    __mockClient: mockClient,
  };
});

jest.mock("./PostgresExecutor", () => ({
  PostgresExecutor: jest.fn().mockImplementation(() => ({
    executeFind: jest.fn(),
    executeCount: jest.fn(),
    executeExists: jest.fn(),
    executeInsert: jest.fn(),
    executeUpdate: jest.fn(),
    executeDelete: jest.fn(),
    executeSoftDelete: jest.fn(),
    executeRestore: jest.fn(),
    executeDeleteExpired: jest.fn(),
    executeTtl: jest.fn(),
    executeIncrement: jest.fn(),
    executeDecrement: jest.fn(),
    executeInsertBulk: jest.fn(),
    executeUpdateMany: jest.fn(),
  })),
}));

jest.mock("./PostgresQueryBuilder", () => ({
  PostgresQueryBuilder: jest.fn().mockImplementation(() => ({
    build: jest.fn(),
  })),
}));

jest.mock("./PostgresRepository", () => ({
  PostgresRepository: jest.fn().mockImplementation((opts: any) => ({
    _opts: opts,
    target: opts.target,
  })),
}));

jest.mock("./MigrationManager", () => ({
  MigrationManager: jest.fn().mockImplementation(() => ({
    apply: jest.fn().mockResolvedValue({ applied: [] }),
  })),
}));

jest.mock("../utils/sync/diff-schema", () => ({
  diffSchema: jest.fn().mockReturnValue({ operations: [] }),
}));

const mockSyncExecute = jest.fn().mockResolvedValue({ statementsExecuted: 0 });
jest.mock("../utils/sync/execute-sync-plan", () => ({
  SyncPlanExecutor: jest.fn().mockImplementation(() => ({
    execute: mockSyncExecute,
  })),
}));

jest.mock("../utils/sync/introspect-schema", () => ({
  introspectSchema: jest.fn().mockResolvedValue({ tables: [] }),
}));

jest.mock("../utils/sync/project-desired-schema", () => ({
  projectDesiredSchema: jest.fn().mockReturnValue({ tables: [] }),
}));

jest.mock("../utils/transaction/begin-transaction", () => ({
  beginTransaction: jest.fn().mockResolvedValue({
    client: { query: jest.fn().mockResolvedValue({ rows: [], rowCount: 0 }) },
    release: jest.fn(),
    state: "active",
    savepointCounter: 0,
  }),
}));

jest.mock("../utils/transaction/commit-transaction", () => ({
  commitTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../utils/transaction/rollback-transaction", () => ({
  rollbackTransaction: jest.fn().mockResolvedValue(undefined),
}));

jest.mock("../utils/transaction/is-retryable-transaction-error", () => ({
  isRetryableTransactionError: jest.fn().mockReturnValue(false),
}));

jest.mock("../utils/transaction/with-retry", () => ({
  withRetry: jest.fn().mockImplementation(async (fn: any) => fn()),
}));

jest.mock("./TransactionContext", () => ({
  TransactionContext: jest
    .fn()
    .mockImplementation((handle, namespace, logger, factory) => ({
      handle,
      namespace,
      factory,
      _isMockContext: true,
    })),
}));

// ─── Imports ──────────────────────────────────────────────────────────────────

import type { ILogger } from "@lindorm/logger";
import { Pool } from "pg";
import { PostgresDriver } from "./PostgresDriver";
import { PostgresRepository } from "./PostgresRepository";
import { PostgresExecutor } from "./PostgresExecutor";
import { PostgresQueryBuilder } from "./PostgresQueryBuilder";
import { beginTransaction } from "../utils/transaction/begin-transaction";
import { commitTransaction } from "../utils/transaction/commit-transaction";
import { rollbackTransaction } from "../utils/transaction/rollback-transaction";
import { withRetry } from "../utils/transaction/with-retry";
import { TransactionContext } from "./TransactionContext";
import { PostgresDriverError } from "../errors/PostgresDriverError";
import { PostgresMigrationError } from "../errors/PostgresMigrationError";
import { SyncPlanExecutor } from "../utils/sync/execute-sync-plan";
import type { IEntity } from "../../../../interfaces";
import type { Constructor } from "@lindorm/types";
import type { EntityMetadata } from "#internal/entity/types/metadata";
import { makeField } from "../../../__fixtures__/make-field";

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
} as unknown as EntityMetadata;

const createMockLogger = (): ILogger =>
  ({
    child: jest.fn().mockReturnThis(),
    silly: jest.fn(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as ILogger;

const getMockPool = () => (require("pg") as any).__mockPool;
const getMockClient = () => (require("pg") as any).__mockClient;

const makeOptions = (overrides: Partial<any> = {}): any => ({
  driver: "postgres",
  logger: createMockLogger(),
  ...overrides,
});

const makeDriver = (overrides: Partial<any> = {}) => {
  const logger = createMockLogger();
  const resolveMetadata = jest.fn().mockReturnValue(mockMetadata);
  const options = makeOptions(overrides);
  const driver = new PostgresDriver(options, logger, null, resolveMetadata);
  return { driver, logger, resolveMetadata };
};

// ─── Tests ────────────────────────────────────────────────────────────────────

describe("PostgresDriver", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    // Restore default mocks after reset
    const mockPool = getMockPool();
    const mockClient = getMockClient();
    mockPool.connect.mockResolvedValue(mockClient);
    mockPool.end.mockResolvedValue(undefined);
    mockPool.query.mockResolvedValue({ rows: [{ "?column?": 1 }], rowCount: 1 });
    mockPool.on.mockReturnValue(undefined);
    mockClient.query.mockResolvedValue({ rows: [], rowCount: 0 });
    mockClient.release.mockReturnValue(undefined);
    (Pool as unknown as jest.Mock).mockImplementation(() => mockPool);
    (beginTransaction as jest.Mock).mockResolvedValue({
      client: mockClient,
      release: jest.fn(),
      state: "active",
      savepointCounter: 0,
    });
    (commitTransaction as jest.Mock).mockResolvedValue(undefined);
    (rollbackTransaction as jest.Mock).mockResolvedValue(undefined);
    (withRetry as jest.Mock).mockImplementation(async (fn: any) => fn());
    // Restore TransactionContext mock
    (TransactionContext as unknown as jest.Mock).mockImplementation(
      (handle: any, namespace: any, logger: any, factory: any) => ({
        handle,
        namespace,
        factory,
        _isMockContext: true,
      }),
    );
    // Restore sync utilities
    const { projectDesiredSchema } = require("../utils/sync/project-desired-schema");
    (projectDesiredSchema as jest.Mock).mockReturnValue({ tables: [] });
    const { introspectSchema } = require("../utils/sync/introspect-schema");
    (introspectSchema as jest.Mock).mockResolvedValue({ tables: [] });
    const { diffSchema } = require("../utils/sync/diff-schema");
    (diffSchema as jest.Mock).mockReturnValue({ operations: [] });
    mockSyncExecute.mockResolvedValue({ statementsExecuted: 0 });
    // Re-wire SyncPlanExecutor constructor after resetAllMocks
    (SyncPlanExecutor as unknown as jest.Mock).mockImplementation(() => ({
      execute: mockSyncExecute,
    }));
    // Restore MigrationManager mock
    const { MigrationManager } = require("./MigrationManager");
    (MigrationManager as jest.Mock).mockImplementation(() => ({
      apply: jest.fn().mockResolvedValue({ applied: [] }),
    }));
  });

  // ─── connect / disconnect ─────────────────────────────────────────────

  describe("connect", () => {
    test("creates a Pool and verifies connection", async () => {
      const { driver } = makeDriver();
      const mockPool = getMockPool();

      await driver.connect();

      expect(Pool).toHaveBeenCalledTimes(1);
      expect(mockPool.connect).toHaveBeenCalled();
    });

    test("releases the test client after connection verification", async () => {
      const { driver } = makeDriver();
      const mockClient = getMockClient();

      await driver.connect();

      expect(mockClient.release).toHaveBeenCalled();
    });

    test("is idempotent — second connect() call is a no-op", async () => {
      const { driver } = makeDriver();

      await driver.connect();
      await driver.connect();

      expect(Pool).toHaveBeenCalledTimes(1);
    });

    test("concurrent connect() calls share the same promise (no pool leak)", async () => {
      const { driver } = makeDriver();

      // Launch both calls without awaiting the first — both must observe the
      // same in-flight connectingPromise, resulting in exactly one Pool construction.
      const [p1, p2] = [driver.connect(), driver.connect()];
      await Promise.all([p1, p2]);

      expect(Pool).toHaveBeenCalledTimes(1);
    });

    test("registers error listener on pool", async () => {
      const { driver } = makeDriver();
      const mockPool = getMockPool();

      await driver.connect();

      expect(mockPool.on).toHaveBeenCalledWith("error", expect.any(Function));
    });
  });

  describe("disconnect", () => {
    test("ends the pool and sets pool to null", async () => {
      const { driver } = makeDriver();
      const mockPool = getMockPool();
      await driver.connect();

      await driver.disconnect();

      expect(mockPool.end).toHaveBeenCalled();
    });

    test("is idempotent — disconnect when not connected is a no-op", async () => {
      const { driver } = makeDriver();

      await expect(driver.disconnect()).resolves.toBeUndefined();
    });

    test("allows reconnect after disconnect", async () => {
      const { driver } = makeDriver();
      await driver.connect();
      await driver.disconnect();

      await driver.connect();

      expect(Pool).toHaveBeenCalledTimes(2);
    });
  });

  // ─── ping ─────────────────────────────────────────────────────────────

  describe("ping", () => {
    test("returns true when SELECT 1 succeeds", async () => {
      const { driver } = makeDriver();
      await driver.connect();

      const result = await driver.ping();

      expect(result).toBe(true);
    });

    test("returns false when pool query throws", async () => {
      const { driver } = makeDriver();
      await driver.connect();
      getMockPool().query.mockRejectedValue(new Error("connection refused"));

      const result = await driver.ping();

      expect(result).toBe(false);
    });

    test("returns false when not connected (getPool throws, caught internally)", async () => {
      const { driver } = makeDriver();

      // ping() has an internal try-catch — when the pool is null, getPool() throws
      // PostgresDriverError which is caught and returns false
      const result = await driver.ping();

      expect(result).toBe(false);
    });
  });

  // ─── getPool guard ─────────────────────────────────────────────────────

  describe("getPool guard (not connected)", () => {
    test("query throws PostgresDriverError when not connected", async () => {
      const { driver } = makeDriver();

      await expect(driver.query("SELECT 1")).rejects.toThrow(PostgresDriverError);
    });

    test("createRepository throws PostgresDriverError when not connected", () => {
      const { driver } = makeDriver();

      expect(() => driver.createRepository(TestEntity)).toThrow(PostgresDriverError);
    });

    test("createExecutor throws PostgresDriverError when not connected", () => {
      const { driver } = makeDriver();

      expect(() => driver.createExecutor(TestEntity)).toThrow(PostgresDriverError);
    });

    test("createQueryBuilder throws PostgresDriverError when not connected", () => {
      const { driver } = makeDriver();

      expect(() => driver.createQueryBuilder(TestEntity)).toThrow(PostgresDriverError);
    });
  });

  // ─── query ─────────────────────────────────────────────────────────────

  describe("query", () => {
    test("executes SQL against the pool and returns rows and rowCount", async () => {
      const { driver } = makeDriver();
      await driver.connect();
      getMockPool().query.mockResolvedValue({ rows: [{ id: "1" }], rowCount: 1 });

      const result = await driver.query<{ id: string }>(
        "SELECT * FROM test WHERE id = $1",
        ["1"],
      );

      expect(result.rows).toEqual([{ id: "1" }]);
      expect(result.rowCount).toBe(1);
    });

    test("handles null rowCount by returning 0", async () => {
      const { driver } = makeDriver();
      await driver.connect();
      getMockPool().query.mockResolvedValue({ rows: [], rowCount: null });

      const result = await driver.query("DELETE FROM test");

      expect(result.rowCount).toBe(0);
    });
  });

  // ─── createRepository ────────────────────────────────────────────────────

  describe("createRepository", () => {
    test("creates a PostgresRepository instance", () => {
      const { driver, resolveMetadata } = makeDriver();
      getMockPool(); // ensure pool mock is set up
      // Manually inject pool
      (driver as any).pool = getMockPool();

      const repo = driver.createRepository(TestEntity);

      expect(repo).toBeDefined();
      expect(resolveMetadata).toHaveBeenCalledWith(TestEntity);
    });

    test("passes target to PostgresRepository constructor", () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      driver.createRepository(TestEntity);

      const constructorCall = (PostgresRepository as jest.Mock).mock.calls[0][0];
      expect(constructorCall.target).toBe(TestEntity);
    });

    test("passes parent when provided", () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      class ParentEntity implements IEntity {
        [key: string]: any;
      }
      driver.createRepository(TestEntity, ParentEntity);

      const constructorCall = (PostgresRepository as jest.Mock).mock.calls[0][0];
      expect(constructorCall.parent).toBe(ParentEntity);
    });

    test("passes namespace to repository", () => {
      const logger = createMockLogger();
      const resolveMetadata = jest.fn().mockReturnValue(mockMetadata);
      const driver = new PostgresDriver(
        { driver: "postgres" } as any,
        logger,
        "my_schema",
        resolveMetadata,
      );
      (driver as any).pool = getMockPool();

      driver.createRepository(TestEntity);

      const constructorCall = (PostgresRepository as jest.Mock).mock.calls[0][0];
      expect(constructorCall.namespace).toBe("my_schema");
    });
  });

  // ─── createTransactionalRepository ───────────────────────────────────────

  describe("createTransactionalRepository", () => {
    test("creates a PostgresRepository using the transaction handle's client", () => {
      const { driver, resolveMetadata } = makeDriver();
      const mockHandle = {
        client: { query: jest.fn() },
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };

      driver.createTransactionalRepository(TestEntity, mockHandle as any);

      expect(resolveMetadata).toHaveBeenCalledWith(TestEntity);
      const constructorCall = (PostgresRepository as jest.Mock).mock.calls[0][0];
      expect(constructorCall.target).toBe(TestEntity);
    });
  });

  // ─── createExecutor ────────────────────────────────────────────────────────

  describe("createExecutor", () => {
    test("creates a PostgresExecutor instance", () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      const executor = driver.createExecutor(TestEntity);

      expect(PostgresExecutor).toHaveBeenCalled();
      expect(executor).toBeDefined();
    });
  });

  // ─── createTransactionalExecutor ─────────────────────────────────────────

  describe("createTransactionalExecutor", () => {
    test("creates a PostgresExecutor using the transaction handle's client", () => {
      const { driver } = makeDriver();
      const mockHandle = {
        client: { query: jest.fn() },
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };

      driver.createTransactionalExecutor(TestEntity, mockHandle as any);

      expect(PostgresExecutor).toHaveBeenCalled();
    });
  });

  // ─── createQueryBuilder ────────────────────────────────────────────────────

  describe("createQueryBuilder", () => {
    test("creates a PostgresQueryBuilder instance", () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      const qb = driver.createQueryBuilder(TestEntity);

      expect(PostgresQueryBuilder).toHaveBeenCalled();
      expect(qb).toBeDefined();
    });
  });

  // ─── createTransactionalQueryBuilder ─────────────────────────────────────

  describe("createTransactionalQueryBuilder", () => {
    test("creates a PostgresQueryBuilder using the transaction handle's client", () => {
      const { driver } = makeDriver();
      const mockHandle = {
        client: { query: jest.fn() },
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };

      driver.createTransactionalQueryBuilder(TestEntity, mockHandle as any);

      expect(PostgresQueryBuilder).toHaveBeenCalled();
    });
  });

  // ─── acquireClient ─────────────────────────────────────────────────────────

  describe("acquireClient", () => {
    test("calls pool.connect and returns the client", async () => {
      const { driver } = makeDriver();
      const mockPool = getMockPool();
      const mockClient = getMockClient();
      (driver as any).pool = mockPool;

      const client = await driver.acquireClient();

      expect(mockPool.connect).toHaveBeenCalled();
      expect(client).toBe(mockClient);
    });
  });

  // ─── cloneWithGetters ─────────────────────────────────────────────────────

  describe("cloneWithGetters", () => {
    test("returns a new PostgresDriver instance sharing the same pool", async () => {
      const { driver } = makeDriver();
      await driver.connect();

      const newFilterRegistry = jest.fn().mockReturnValue(new Map());
      const newSubscribers = jest.fn().mockReturnValue([]);

      const cloned = driver.cloneWithGetters(newFilterRegistry, newSubscribers);

      expect(cloned).toBeInstanceOf(PostgresDriver);
      expect(cloned).not.toBe(driver);
      // Shares the same pool reference
      expect((cloned as any).pool).toBe((driver as any).pool);
    });

    test("cloned driver uses the provided getFilterRegistry", async () => {
      const { driver } = makeDriver();
      await driver.connect();

      const newFilterRegistry = jest.fn().mockReturnValue(new Map([["key", "value"]]));
      const newSubscribers = jest.fn().mockReturnValue([]);

      const cloned = driver.cloneWithGetters(newFilterRegistry, newSubscribers);

      expect((cloned as any).getFilterRegistry).toBe(newFilterRegistry);
      expect((cloned as any).getSubscribers).toBe(newSubscribers);
    });
  });

  // ─── beginTransaction / commitTransaction / rollbackTransaction ───────────

  describe("beginTransaction", () => {
    test("delegates to beginTransaction utility", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      await driver.beginTransaction();

      expect(beginTransaction).toHaveBeenCalled();
    });
  });

  describe("commitTransaction", () => {
    test("delegates to commitTransaction utility", async () => {
      const { driver } = makeDriver();
      const handle = {
        client: getMockClient(),
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };

      await driver.commitTransaction(handle as any);

      expect(commitTransaction).toHaveBeenCalledWith(handle);
    });
  });

  describe("rollbackTransaction", () => {
    test("delegates to rollbackTransaction utility", async () => {
      const { driver } = makeDriver();
      const handle = {
        client: getMockClient(),
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };

      await driver.rollbackTransaction(handle as any);

      expect(rollbackTransaction).toHaveBeenCalledWith(handle);
    });
  });

  // ─── withTransaction ───────────────────────────────────────────────────────

  describe("withTransaction", () => {
    test("executes callback with a TransactionContext", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      const callback = jest.fn().mockResolvedValue("result");

      const result = await driver.withTransaction(callback);

      expect(callback).toHaveBeenCalledWith(
        expect.objectContaining({ _isMockContext: true }),
      );
      expect(result).toBe("result");
    });

    test("commits transaction when callback succeeds", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();
      const mockHandle = {
        client: getMockClient(),
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };
      (beginTransaction as jest.Mock).mockResolvedValue(mockHandle);

      await driver.withTransaction(jest.fn().mockResolvedValue(undefined));

      expect(commitTransaction).toHaveBeenCalledWith(mockHandle);
    });

    test("rolls back transaction when callback throws", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();
      const mockHandle = {
        client: getMockClient(),
        release: jest.fn(),
        state: "active",
        savepointCounter: 0,
      };
      (beginTransaction as jest.Mock).mockResolvedValue(mockHandle);

      const error = new Error("callback failed");
      await expect(
        driver.withTransaction(jest.fn().mockRejectedValue(error)),
      ).rejects.toThrow("callback failed");

      expect(rollbackTransaction).toHaveBeenCalledWith(mockHandle);
    });

    test("does not commit if handle state is not active", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();
      const mockHandle = {
        client: getMockClient(),
        release: jest.fn(),
        state: "committed", // Already committed
        savepointCounter: 0,
      };
      (beginTransaction as jest.Mock).mockResolvedValue(mockHandle);

      await driver.withTransaction(jest.fn().mockResolvedValue(undefined));

      expect(commitTransaction).not.toHaveBeenCalled();
    });

    test("uses withRetry when retry option is provided", async () => {
      const { driver } = makeDriver();
      (driver as any).pool = getMockPool();

      const retryOptions = { maxAttempts: 3, delay: 0 };
      await driver.withTransaction(jest.fn().mockResolvedValue("ok"), {
        retry: retryOptions as any,
      });

      expect(withRetry).toHaveBeenCalled();
    });
  });

  // ─── setup ─────────────────────────────────────────────────────────────────

  describe("setup", () => {
    test("throws PostgresMigrationError when both synchronize and runMigrations are set", async () => {
      const { driver } = makeDriver({ synchronize: true, runMigrations: true });
      (driver as any).pool = getMockPool();

      await expect(driver.setup([])).rejects.toThrow(PostgresMigrationError);
    });

    test("auto-connects if pool is null before setup", async () => {
      const { driver } = makeDriver();
      // Pool not connected yet

      await driver.setup([]);

      expect(Pool).toHaveBeenCalled();
    });

    test("does not run migrations or sync when neither option is set", async () => {
      const { driver } = makeDriver();
      const { MigrationManager } = require("./MigrationManager");
      (driver as any).pool = getMockPool();

      await driver.setup([]);

      expect(MigrationManager).not.toHaveBeenCalled();
      expect(mockSyncExecute).not.toHaveBeenCalled();
    });

    test("runs synchronize when synchronize option is true", async () => {
      const { driver } = makeDriver({ synchronize: true });
      (driver as any).pool = getMockPool();

      await driver.setup([TestEntity]);

      expect(mockSyncExecute).toHaveBeenCalled();
    });

    test("runs migration manager when runMigrations is true and directories provided", async () => {
      const { driver } = makeDriver({
        runMigrations: true,
        migrations: ["/path/to/migrations"],
      });
      (driver as any).pool = getMockPool();
      const { MigrationManager } = require("./MigrationManager");

      await driver.setup([]);

      expect(MigrationManager).toHaveBeenCalled();
    });
  });
});
