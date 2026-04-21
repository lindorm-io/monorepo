import type { EntityMetadata } from "../../../../entity/types/metadata";
import type { PostgresQueryClient } from "../../types/postgres-query-client";
import type { DbSnapshot } from "../../types/db-snapshot";
import type { DesiredSchema } from "../../types/desired-schema";
import type { SyncPlan, SyncOperation } from "../../types/sync-plan";
import type { SerializedMigration } from "./serialize-migration";
import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// --- Mock all external dependencies ---

vi.mock("../sync/introspect-schema", async () => ({
  introspectSchema: vi.fn(),
}));

vi.mock("../sync/project-desired-schema", () => ({
  projectDesiredSchema: vi.fn(),
}));

vi.mock("../sync/diff-schema", () => ({
  diffSchema: vi.fn(),
}));

vi.mock("./serialize-migration", () => ({
  serializeMigration: vi.fn(),
}));

vi.mock("./write-migration-file", () => ({
  writeMigrationFile: vi.fn(),
}));

vi.mock("./migration-table", () => ({
  ensureMigrationTable: vi.fn(),
  insertMigrationRecord: vi.fn(),
  markMigrationFinished: vi.fn(),
}));

vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

import { introspectSchema } from "../sync/introspect-schema";
import { projectDesiredSchema } from "../sync/project-desired-schema";
import { diffSchema } from "../sync/diff-schema";
import { serializeMigration } from "./serialize-migration";
import { writeMigrationFile } from "./write-migration-file";
import {
  ensureMigrationTable,
  insertMigrationRecord,
  markMigrationFinished,
} from "./migration-table";
import { generateBaselineMigration } from "./generate-baseline-migration";

const mockIntrospect = introspectSchema as MockedFunction<typeof introspectSchema>;
const mockProject = projectDesiredSchema as MockedFunction<typeof projectDesiredSchema>;
const mockDiff = diffSchema as MockedFunction<typeof diffSchema>;
const mockSerialize = serializeMigration as MockedFunction<typeof serializeMigration>;
const mockWrite = writeMigrationFile as MockedFunction<typeof writeMigrationFile>;
const mockEnsureTable = ensureMigrationTable as MockedFunction<
  typeof ensureMigrationTable
>;
const mockInsert = insertMigrationRecord as MockedFunction<typeof insertMigrationRecord>;
const mockMarkFinished = markMigrationFinished as MockedFunction<
  typeof markMigrationFinished
>;

// --- fixtures ---

const emptySnapshot: DbSnapshot = { tables: [], enums: [], schemas: [] };

const emptyDesired: DesiredSchema = {
  tables: [],
  enums: [],
  schemas: [],
  extensions: [],
};

const desiredWithTable: DesiredSchema = {
  tables: [
    {
      schema: "app",
      name: "users",
      columns: [],
      constraints: [],
      indexes: [],
      comment: null,
      columnComments: {},
      triggers: [],
    },
  ],
  enums: [],
  schemas: ["app"],
  extensions: [],
};

const makeTxOp = (): SyncOperation => ({
  type: "create_table",
  severity: "safe",
  schema: "app",
  table: "users",
  description: 'Create table "app"."users"',
  sql: 'CREATE TABLE "app"."users" ("id" UUID NOT NULL);',
  autocommit: false,
});

const makePlan = (ops: Array<SyncOperation>): SyncPlan => ({
  operations: ops,
  summary: { safe: ops.length, warning: 0, destructive: 0, total: ops.length },
});

const fixedMigration: SerializedMigration = {
  filename: "20260220090000-baseline.ts",
  content: "// migration content",
  checksum: "abc123",
  id: "00000000-0000-0000-0000-000000000001",
  ts: "2026-02-20T09:00:00.000Z",
};

const mockClient: PostgresQueryClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const fixedTimestamp = new Date("2026-02-20T09:00:00.000Z");

beforeEach(() => {
  vi.clearAllMocks();
  mockProject.mockReturnValue(emptyDesired);
  mockDiff.mockReturnValue(makePlan([]));
  mockIntrospect.mockResolvedValue(emptySnapshot);
  mockSerialize.mockReturnValue(fixedMigration);
  mockWrite.mockResolvedValue("/tmp/migrations/20260220090000-baseline.ts");
  mockEnsureTable.mockResolvedValue(undefined);
  mockInsert.mockResolvedValue(undefined);
  mockMarkFinished.mockResolvedValue(undefined);
});

// --- basic orchestration ---

describe("generateBaselineMigration — orchestration", () => {
  it("should call projectDesiredSchema with provided metadataList and namespaceOptions", async () => {
    const nsOpts = { namespace: "app" };
    const metaList = [{} as EntityMetadata];

    await generateBaselineMigration(mockClient, metaList, nsOpts, {
      directory: "/tmp/migrations",
      timestamp: fixedTimestamp,
    });

    expect(mockProject).toHaveBeenCalledWith(metaList, nsOpts);
  });

  it("should diff empty snapshot against desired schema", async () => {
    mockProject.mockReturnValue(desiredWithTable);
    mockDiff.mockReturnValue(makePlan([makeTxOp()]));
    mockIntrospect.mockResolvedValue(emptySnapshot);

    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    // First diffSchema call: empty snapshot vs desired
    const firstCall = mockDiff.mock.calls[0];
    expect(firstCall[0]).toEqual(emptySnapshot);
    expect(firstCall[1]).toBe(desiredWithTable);
  });

  it("should serialize the plan with default name 'baseline' when no name provided", async () => {
    mockDiff.mockReturnValue(makePlan([makeTxOp()]));

    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    expect(mockSerialize).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: "baseline", timestamp: fixedTimestamp }),
    );
  });

  it("should serialize with custom name when provided", async () => {
    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        name: "initial-schema",
        timestamp: fixedTimestamp,
      },
    );

    expect(mockSerialize).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ name: "initial-schema" }),
    );
  });

  it("should write migration file to specified directory", async () => {
    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    expect(mockWrite).toHaveBeenCalledWith(
      "/tmp/migrations",
      fixedMigration.filename,
      fixedMigration.content,
    );
  });

  it("should introspect live schema before writing file", async () => {
    mockProject.mockReturnValue(desiredWithTable);
    mockDiff.mockReturnValue(makePlan([makeTxOp()]));

    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    expect(mockIntrospect).toHaveBeenCalledWith(mockClient, [
      { schema: "app", name: "users" },
    ]);
  });
});

// --- result shape ---

describe("generateBaselineMigration — result shape", () => {
  it("should return the migration object from serializeMigration", async () => {
    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    expect(result.migration).toBe(fixedMigration);
  });

  it("should return the filepath from writeMigrationFile", async () => {
    mockWrite.mockResolvedValue("/custom/path/20260220090000-baseline.ts");

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    expect(result.filepath).toBe("/custom/path/20260220090000-baseline.ts");
  });

  it("should count only non-warn_only operations in operationCount", async () => {
    const plan = makePlan([
      makeTxOp(),
      {
        type: "warn_only",
        severity: "warning",
        schema: null,
        table: null,
        description: "stale",
        sql: "",
        autocommit: false,
      },
    ]);
    mockDiff.mockReturnValue(plan);

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    expect(result.operationCount).toBe(1);
  });

  it("should report operationCount=0 for empty plan", async () => {
    mockDiff.mockReturnValue(makePlan([]));

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    expect(result.operationCount).toBe(0);
  });
});

// --- markedAsApplied logic ---

describe("generateBaselineMigration — markedAsApplied", () => {
  it("should mark as applied when live DB already matches desired schema (no pending ops)", async () => {
    // First diff (empty vs desired) has ops, but live diff has none
    mockDiff
      .mockReturnValueOnce(makePlan([makeTxOp()])) // baseline diff
      .mockReturnValueOnce(makePlan([])); // live diff — already in sync
    mockIntrospect.mockResolvedValue(emptySnapshot);
    mockProject.mockReturnValue(desiredWithTable);

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    expect(result.markedAsApplied).toBe(true);
    expect(mockEnsureTable).toHaveBeenCalledTimes(1);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    expect(mockMarkFinished).toHaveBeenCalledWith(
      mockClient,
      fixedMigration.id,
      undefined,
    );
  });

  it("should NOT mark as applied when live DB differs from desired schema", async () => {
    // Both diffs have ops — live DB is not in sync
    mockDiff
      .mockReturnValueOnce(makePlan([makeTxOp()])) // baseline diff
      .mockReturnValueOnce(makePlan([makeTxOp()])); // live diff — still pending

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    expect(result.markedAsApplied).toBe(false);
    expect(mockEnsureTable).not.toHaveBeenCalled();
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockMarkFinished).not.toHaveBeenCalled();
  });

  it("should pass tableOptions to ensureMigrationTable and insertMigrationRecord", async () => {
    mockDiff
      .mockReturnValueOnce(makePlan([makeTxOp()]))
      .mockReturnValueOnce(makePlan([]));

    const tableOptions = { schema: "custom_schema", table: "my_migrations" };

    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        tableOptions,
        timestamp: fixedTimestamp,
      },
    );

    expect(mockEnsureTable).toHaveBeenCalledWith(mockClient, tableOptions);
    expect(mockInsert).toHaveBeenCalledWith(mockClient, expect.anything(), tableOptions);
    expect(mockMarkFinished).toHaveBeenCalledWith(
      mockClient,
      fixedMigration.id,
      tableOptions,
    );
  });

  it("should insert record with migration id, name (without .ts), and checksum", async () => {
    mockDiff
      .mockReturnValueOnce(makePlan([makeTxOp()]))
      .mockReturnValueOnce(makePlan([]));

    await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
        timestamp: fixedTimestamp,
      },
    );

    expect(mockInsert).toHaveBeenCalledWith(
      mockClient,
      expect.objectContaining({
        id: fixedMigration.id,
        name: "20260220090000-baseline", // .ts extension stripped
        checksum: fixedMigration.checksum,
      }),
      undefined,
    );
  });
});

// --- warn_only filtering ---

describe("generateBaselineMigration — warn_only in live diff", () => {
  it("should treat warn_only ops as not pending when checking live DB", async () => {
    mockDiff.mockReturnValueOnce(makePlan([makeTxOp()])).mockReturnValueOnce(
      makePlan([
        {
          type: "warn_only",
          severity: "warning",
          schema: null,
          table: null,
          description: "stale",
          sql: "",
          autocommit: false,
        },
      ]),
    );

    const result = await generateBaselineMigration(
      mockClient,
      [],
      { namespace: "app" },
      {
        directory: "/tmp/migrations",
      },
    );

    // Only warn_only in live diff → counts as 0 pending → should mark as applied
    expect(result.markedAsApplied).toBe(true);
  });
});

// --- error propagation ---

describe("generateBaselineMigration — error propagation", () => {
  it("should propagate writeMigrationFile error", async () => {
    mockWrite.mockRejectedValueOnce(new Error("EACCES: permission denied"));

    await expect(
      generateBaselineMigration(
        mockClient,
        [],
        { namespace: "app" },
        {
          directory: "/tmp/migrations",
          timestamp: fixedTimestamp,
        },
      ),
    ).rejects.toThrow("EACCES");
  });

  it("should propagate introspectSchema error", async () => {
    mockProject.mockReturnValue(desiredWithTable);
    mockDiff.mockReturnValue(makePlan([makeTxOp()]));
    mockIntrospect.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      generateBaselineMigration(
        mockClient,
        [],
        { namespace: "app" },
        {
          directory: "/tmp/migrations",
          timestamp: fixedTimestamp,
        },
      ),
    ).rejects.toThrow("connection lost");
  });

  it("should not write file when introspection fails", async () => {
    mockProject.mockReturnValue(desiredWithTable);
    mockDiff.mockReturnValue(makePlan([makeTxOp()]));
    mockIntrospect.mockRejectedValueOnce(new Error("connection lost"));

    await expect(
      generateBaselineMigration(
        mockClient,
        [],
        { namespace: "app" },
        {
          directory: "/tmp/migrations",
          timestamp: fixedTimestamp,
        },
      ),
    ).rejects.toThrow("connection lost");

    expect(mockWrite).not.toHaveBeenCalled();
  });
});
