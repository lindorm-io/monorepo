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
    info: [],
    warn: [],
    error: [],
  };
  const logger: ILogger = {
    debug: vi.fn((...args: Array<unknown>) => calls.debug.push(args)),
    info: vi.fn((...args: Array<unknown>) => calls.info.push(args)),
    warn: vi.fn((...args: Array<unknown>) => calls.warn.push(args)),
    error: vi.fn((...args: Array<unknown>) => calls.error.push(args)),
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
    expect(calls.info.length).toBeGreaterThan(0);
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
