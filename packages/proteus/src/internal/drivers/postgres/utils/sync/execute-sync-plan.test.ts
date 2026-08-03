import type { ILogger } from "@lindorm/logger";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type { SyncOperation, SyncOptions, SyncPlan } from "../../types/sync-plan.js";
import { SyncPlanExecutor } from "./execute-sync-plan.js";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// Mock advisory-lock so we can control whether it "acquires" the lock
vi.mock("../advisory-lock.js", async () => ({
  withAdvisoryLock: vi.fn(
    async (_client: unknown, _k1: unknown, _k2: unknown, fn: () => Promise<unknown>) =>
      fn(),
  ),
}));

import { withAdvisoryLock } from "../advisory-lock.js";

const mockWithAdvisoryLock = withAdvisoryLock as MockedFunction<typeof withAdvisoryLock>;

// --- helpers ---

/** Convenience wrapper matching the old free-function signature for minimal test churn */
const executeSyncPlan = (
  client: PostgresQueryClient,
  plan: SyncPlan,
  options: SyncOptions & { logger?: ILogger } = {},
) => {
  const { logger, ...rest } = options;
  return new SyncPlanExecutor(logger).execute(client, plan, rest);
};

const makeClient = (): { client: PostgresQueryClient; queries: Array<string> } => {
  const queries: Array<string> = [];
  const client: PostgresQueryClient = {
    query: vi.fn(async (sql: string) => {
      queries.push(sql);
      return { rows: [], rowCount: 0 };
    }),
  };
  return { client, queries };
};

const makeTxOp = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  type: "add_column",
  severity: "safe",
  schema: "public",
  table: "users",
  description: 'Add column "email"',
  sql: 'ALTER TABLE "public"."users" ADD COLUMN "email" TEXT;',
  autocommit: false,
  ...overrides,
});

const makeAutocommitOp = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  type: "add_enum_value",
  severity: "safe",
  schema: "public",
  table: null,
  description: "Add enum value",
  sql: "ALTER TYPE t ADD VALUE 'x';",
  autocommit: true,
  ...overrides,
});

const makeExtensionOp = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  type: "create_extension",
  severity: "safe",
  schema: null,
  table: null,
  description: 'Create extension "pg_trgm"',
  sql: 'CREATE EXTENSION IF NOT EXISTS "pg_trgm";',
  autocommit: false,
  extension: "pg_trgm",
  ...overrides,
});

const makeWarnOp = (overrides: Partial<SyncOperation> = {}): SyncOperation => ({
  type: "warn_only",
  severity: "warning",
  schema: "public",
  table: null,
  description: "Stale enum value",
  sql: "",
  autocommit: false,
  ...overrides,
});

const makePlan = (operations: Array<SyncOperation>): SyncPlan => ({
  operations,
  summary: { safe: 0, warning: 0, destructive: 0, total: operations.length },
});

const makeLogger = (): {
  logger: ILogger;
  calls: Record<string, Array<Array<unknown>>>;
} => {
  const calls: Record<string, Array<Array<unknown>>> = {
    debug: [],
    verbose: [],
    info: [],
    warn: [],
    error: [],
    silly: [],
  };
  const logger: ILogger = {
    debug: vi.fn((...args: Array<unknown>) => calls.debug.push(args)),
    verbose: vi.fn((...args: Array<unknown>) => calls.verbose.push(args)),
    info: vi.fn((...args: Array<unknown>) => calls.info.push(args)),
    warn: vi.fn((...args: Array<unknown>) => calls.warn.push(args)),
    error: vi.fn((...args: Array<unknown>) => calls.error.push(args)),
    silly: vi.fn((...args: Array<unknown>) => calls.silly.push(args)),
    child: vi.fn(() => logger),
  } as unknown as ILogger;
  return { logger, calls };
};

beforeEach(() => {
  vi.clearAllMocks();
  // Default: advisory lock succeeds
  mockWithAdvisoryLock.mockImplementation(async (_c, _k1, _k2, fn) => fn());
});

// --- dry run ---

describe("SyncPlanExecutor — dry run", () => {
  it("should return executed=false without calling the client", async () => {
    const { client } = makeClient();
    const plan = makePlan([makeTxOp()]);
    const result = await executeSyncPlan(client, plan, { dryRun: true });
    expect(result.executed).toBe(false);
    expect(result.statementsExecuted).toBe(0);
    expect(result.executedSql).toHaveLength(0);
    expect(result.failedOperations).toHaveLength(0);
    expect(client.query).not.toHaveBeenCalled();
  });

  it("should attach plan to dry-run result", async () => {
    const { client } = makeClient();
    const plan = makePlan([makeTxOp()]);
    const result = await executeSyncPlan(client, plan, { dryRun: true });
    expect(result.plan).toBe(plan);
  });

  it("should log the plan in dry run when logger is provided", async () => {
    const { client } = makeClient();
    const { logger, calls } = makeLogger();
    const plan = makePlan([makeTxOp()]);
    await executeSyncPlan(client, plan, { dryRun: true, logger });
    expect(calls.verbose.length).toBeGreaterThan(0);
  });
});

// --- empty plan (no executable ops) ---

describe("SyncPlanExecutor — empty plan", () => {
  it("should return executed=true with 0 statements for empty operations", async () => {
    const { client } = makeClient();
    const plan = makePlan([]);
    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);
    expect(result.statementsExecuted).toBe(0);
    expect(result.executedSql).toHaveLength(0);
  });

  it("should return executed=true with 0 statements for warn_only-only plan", async () => {
    const { client } = makeClient();
    const plan = makePlan([makeWarnOp(), makeWarnOp()]);
    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(true);
    expect(result.statementsExecuted).toBe(0);
  });

  it("should log warn_only descriptions", async () => {
    const { client } = makeClient();
    const { logger, calls } = makeLogger();
    const plan = makePlan([makeWarnOp({ description: "stale value X" })]);
    await executeSyncPlan(client, plan, { logger });
    expect(
      calls.warn.some((args: Array<unknown>) =>
        String(args[0]).includes("stale value X"),
      ),
    ).toBe(true);
  });
});

// --- transactional operations ---

describe("SyncPlanExecutor — transactional operations", () => {
  it("should wrap transactional ops in BEGIN/COMMIT", async () => {
    const { client, queries } = makeClient();
    const plan = makePlan([makeTxOp()]);
    await executeSyncPlan(client, plan);
    expect(queries).toContain("BEGIN");
    expect(queries).toContain("COMMIT");
  });

  it("should execute the operation SQL inside the transaction", async () => {
    const { client, queries } = makeClient();
    const op = makeTxOp({ sql: 'ALTER TABLE "t" ADD COLUMN "x" TEXT;' });
    await executeSyncPlan(client, makePlan([op]));
    expect(queries).toContain('ALTER TABLE "t" ADD COLUMN "x" TEXT;');
  });

  it("should rollback and throw PostgresSyncError on SQL failure", async () => {
    const { queries } = makeClient();
    let callCount = 0;
    const failClient: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        callCount++;
        if (callCount === 2) throw new Error("syntax error"); // fail on first real op
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(executeSyncPlan(failClient, makePlan([makeTxOp()]))).rejects.toThrow(
      "Sync transaction failed",
    );
    expect(queries).toContain("ROLLBACK");
    expect(queries).not.toContain("COMMIT");
  });

  it("should execute multiple tx ops in the same transaction", async () => {
    const { client, queries } = makeClient();
    const op1 = makeTxOp({ sql: "SQL1;" });
    const op2 = makeTxOp({ sql: "SQL2;" });
    await executeSyncPlan(client, makePlan([op1, op2]));
    const beginIdx = queries.indexOf("BEGIN");
    const commitIdx = queries.indexOf("COMMIT");
    expect(queries.indexOf("SQL1;")).toBeGreaterThan(beginIdx);
    expect(queries.indexOf("SQL2;")).toBeGreaterThan(beginIdx);
    expect(queries.indexOf("SQL1;")).toBeLessThan(commitIdx);
    expect(queries.indexOf("SQL2;")).toBeLessThan(commitIdx);
  });

  it("should record executed SQL in result", async () => {
    const { client } = makeClient();
    const op = makeTxOp({ sql: "UNIQUE_SQL;" });
    const result = await executeSyncPlan(client, makePlan([op]));
    expect(result.executedSql).toContain("UNIQUE_SQL;");
    expect(result.statementsExecuted).toBe(1);
  });
});

// --- autocommit operations ---

describe("SyncPlanExecutor — autocommit operations", () => {
  it("should execute autocommit ops outside transaction (no BEGIN before them)", async () => {
    const { client, queries } = makeClient();
    const op = makeAutocommitOp({ sql: "AUTOCOMMIT_SQL;" });
    await executeSyncPlan(client, makePlan([op]));
    // No BEGIN/COMMIT because only autocommit ops
    expect(queries).not.toContain("BEGIN");
    expect(queries).not.toContain("COMMIT");
    expect(queries).toContain("AUTOCOMMIT_SQL;");
  });

  it("should continue past a failing autocommit op and collect failedOperations", async () => {
    const failedSql = "FAIL_OP;";
    const goodSql = "GOOD_OP;";
    let callCount = 0;
    const failClient: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        callCount++;
        if (sql === failedSql) throw new Error("autocommit-failure");
        return { rows: [], rowCount: 0 };
      }),
    };
    const op1 = makeAutocommitOp({ sql: failedSql });
    const op2 = makeAutocommitOp({ sql: goodSql });
    const result = await executeSyncPlan(failClient, makePlan([op1, op2]));
    expect(result.failedOperations).toHaveLength(1);
    expect(result.failedOperations[0].operation.sql).toBe(failedSql);
    expect(result.executedSql).toContain(goodSql);
  });

  it("should record autocommit SQL in executedSql", async () => {
    const { client } = makeClient();
    const result = await executeSyncPlan(
      client,
      makePlan([makeAutocommitOp({ sql: "AUTOCOMMIT_SQL;" })]),
    );
    expect(result.executedSql).toContain("AUTOCOMMIT_SQL;");
  });
});

// --- mixed tx + autocommit ---

describe("SyncPlanExecutor — mixed operations", () => {
  it("should execute tx first, then autocommit", async () => {
    const { client, queries } = makeClient();
    const txOp = makeTxOp({ sql: "TX_SQL;" });
    const autoOp = makeAutocommitOp({ sql: "AUTO_SQL;" });
    await executeSyncPlan(client, makePlan([txOp, autoOp]));
    const txIdx = queries.indexOf("TX_SQL;");
    const autoIdx = queries.indexOf("AUTO_SQL;");
    expect(txIdx).toBeGreaterThan(-1);
    expect(autoIdx).toBeGreaterThan(-1);
    expect(txIdx).toBeLessThan(autoIdx);
  });

  it("should count all executed statements in statementsExecuted", async () => {
    const { client } = makeClient();
    const txOp = makeTxOp({ sql: "TX_SQL;" });
    const autoOp = makeAutocommitOp({ sql: "AUTO_SQL;" });
    const result = await executeSyncPlan(client, makePlan([txOp, autoOp]));
    expect(result.statementsExecuted).toBe(2);
  });
});

// --- extension operations ---

/**
 * Extensions are DATABASE-scoped, so they must not ride in the namespace-scoped
 * plan transaction: a concurrent creator would abort it and take every
 * unrelated DDL statement with it.
 */
describe("SyncPlanExecutor — extension operations", () => {
  it("should create extensions in their own transaction under a db-wide xact lock", async () => {
    const { client, queries } = makeClient();
    await executeSyncPlan(client, makePlan([makeExtensionOp()]));
    expect(queries).toMatchSnapshot();
  });

  it("should hold a lock key pair distinct from the namespace sync lock", async () => {
    const queries: Array<{ sql: string; params?: Array<unknown> }> = [];
    const client: PostgresQueryClient = {
      query: vi.fn(async (sql: string, params?: Array<unknown>) => {
        queries.push({ sql, params });
        return { rows: [], rowCount: 0 };
      }),
    };
    await executeSyncPlan(client, makePlan([makeExtensionOp()]));
    const lock = queries.find((q) => q.sql.includes("pg_advisory_xact_lock"));
    expect(lock!.params).toEqual([0x50474558, 0x53594e43]);
    // key1 differs from the namespace lock's "PROT", so the pairs are disjoint
    expect(lock!.params![0]).not.toBe(0x50524f54);
  });

  it("should apply lock_timeout inside the extension transaction", async () => {
    const { client, queries } = makeClient();
    await executeSyncPlan(client, makePlan([makeExtensionOp()]), { lockTimeout: 2500 });
    expect(queries.filter((sql) => sql.includes("lock_timeout"))).toEqual([
      "SET LOCAL lock_timeout = '2500ms'",
    ]);
  });

  it("should not run extension SQL inside the plan transaction", async () => {
    const { client, queries } = makeClient();
    const extOp = makeExtensionOp();
    const txOp = makeTxOp({ sql: "TX_SQL;" });
    await executeSyncPlan(client, makePlan([extOp, txOp]));
    // The plan transaction is the LAST BEGIN — the extension committed before it
    const planBegin = queries.lastIndexOf("BEGIN");
    expect(queries.indexOf(extOp.sql)).toBeLessThan(planBegin);
    expect(queries.indexOf("TX_SQL;")).toBeGreaterThan(planBegin);
  });

  it("should count the extension statement as executed", async () => {
    const { client } = makeClient();
    const result = await executeSyncPlan(client, makePlan([makeExtensionOp()]));
    expect(result.executedSql).toEqual(['CREATE EXTENSION IF NOT EXISTS "pg_trgm";']);
    expect(result.statementsExecuted).toBe(1);
  });

  it("should throw a lock-timeout error when the extension lock times out", async () => {
    const client: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.includes("pg_advisory_xact_lock")) {
          const error = new Error("canceling statement due to lock timeout");
          (error as Error & { code: string }).code = "55P03";
          throw error;
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(
      executeSyncPlan(client, makePlan([makeExtensionOp()]), { lockTimeout: 500 }),
    ).rejects.toThrow('Sync timed out creating extension "pg_trgm"');
  });

  it("should throw a sync error when the extension cannot be created", async () => {
    const client: PostgresQueryClient = {
      query: vi.fn(async (sql: string) => {
        if (sql.startsWith("CREATE EXTENSION")) {
          const error = new Error("permission denied to create extension");
          (error as Error & { code: string }).code = "42501";
          throw error;
        }
        return { rows: [], rowCount: 0 };
      }),
    };
    await expect(executeSyncPlan(client, makePlan([makeExtensionOp()]))).rejects.toThrow(
      'Failed to create extension "pg_trgm"',
    );
  });
});

// --- extension created by a concurrent peer ---

describe("SyncPlanExecutor — extension duplicate race", () => {
  const makeRacingClient = (
    exists: boolean,
  ): { client: PostgresQueryClient; queries: Array<string> } => {
    const queries: Array<string> = [];
    const client = {
      query: vi.fn(async (sql: string) => {
        queries.push(sql);
        if (sql.startsWith("CREATE EXTENSION")) {
          const error = new Error(
            'duplicate key value violates unique constraint "pg_extension_name_index"',
          );
          (error as Error & { code: string }).code = "23505";
          throw error;
        }
        if (sql.includes("pg_extension")) {
          return exists
            ? { rows: [{ "?column?": 1 }], rowCount: 1 }
            : { rows: [], rowCount: 0 };
        }
        return { rows: [], rowCount: 0 };
      }),
    } as unknown as PostgresQueryClient;
    return { client, queries };
  };

  it("should treat a duplicate as benign when the extension is present afterwards", async () => {
    const { client } = makeRacingClient(true);
    const result = await executeSyncPlan(client, makePlan([makeExtensionOp()]));
    expect(result.executed).toBe(true);
    // Not counted as executed — the peer created it, this session did not
    expect(result.executedSql).toEqual([]);
  });

  it("should continue with the rest of the plan after a benign duplicate", async () => {
    const { client, queries } = makeRacingClient(true);
    const result = await executeSyncPlan(
      client,
      makePlan([makeExtensionOp(), makeTxOp({ sql: "TX_SQL;" })]),
    );
    expect(queries).toContain("TX_SQL;");
    expect(result.executedSql).toEqual(["TX_SQL;"]);
  });

  it("should roll back the extension transaction before continuing", async () => {
    const { client, queries } = makeRacingClient(true);
    await executeSyncPlan(client, makePlan([makeExtensionOp()]));
    expect(queries).toContain("ROLLBACK");
  });

  it("should rethrow the duplicate when the extension is absent afterwards", async () => {
    const { client } = makeRacingClient(false);
    await expect(executeSyncPlan(client, makePlan([makeExtensionOp()]))).rejects.toThrow(
      'Failed to create extension "pg_trgm"',
    );
  });

  it("should rethrow the duplicate when the op carries no extension name", async () => {
    const { client } = makeRacingClient(true);
    await expect(
      executeSyncPlan(client, makePlan([makeExtensionOp({ extension: undefined })])),
    ).rejects.toThrow("Failed to create extension");
  });
});

// --- advisory lock not acquired ---

describe("SyncPlanExecutor — lock not acquired", () => {
  it("should return executed=false when advisory lock is not acquired", async () => {
    mockWithAdvisoryLock.mockResolvedValue(null);
    const { client } = makeClient();
    const plan = makePlan([makeTxOp()]);
    const result = await executeSyncPlan(client, plan);
    expect(result.executed).toBe(false);
    expect(result.statementsExecuted).toBe(0);
  });

  it("should log a warning when lock cannot be acquired", async () => {
    mockWithAdvisoryLock.mockResolvedValue(null);
    const { client } = makeClient();
    const { logger, calls } = makeLogger();
    await executeSyncPlan(client, makePlan([makeTxOp()]), { logger });
    expect(calls.warn.length).toBeGreaterThan(0);
  });
});

// --- result shape ---

describe("SyncPlanExecutor — result shape", () => {
  it("should always include plan in result", async () => {
    const { client } = makeClient();
    const plan = makePlan([makeTxOp()]);
    const result = await executeSyncPlan(client, plan);
    expect(result.plan).toBe(plan);
  });

  it("should include empty failedOperations for fully-successful execution", async () => {
    const { client } = makeClient();
    const result = await executeSyncPlan(client, makePlan([makeTxOp()]));
    expect(result.failedOperations).toHaveLength(0);
  });
});
