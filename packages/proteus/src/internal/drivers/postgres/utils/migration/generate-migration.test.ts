import { mkdtemp, readFile, rm } from "fs/promises";
import { tmpdir } from "os";
import { join } from "path";
import type { DbSnapshot } from "../../types/db-snapshot.js";
import type { DesiredSchema } from "../../types/desired-schema.js";
import type { PostgresQueryClient } from "../../types/postgres-query-client.js";
import type { SyncPlan } from "../../types/sync-plan.js";
import { generateMigration } from "./generate-migration.js";
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
  type Mock,
  type MockedFunction,
} from "vitest";

// Mock the sync pipeline modules
vi.mock("../sync/introspect-schema.js", async () => ({
  introspectSchema: vi.fn(),
}));
vi.mock("../sync/project-desired-schema.js", () => ({
  projectDesiredSchema: vi.fn(),
}));
vi.mock("../sync/diff-schema.js", () => ({
  diffSchema: vi.fn(),
}));

// Stable UUID for snapshots
vi.mock("crypto", async () => ({
  ...(await vi.importActual<typeof import("crypto")>("crypto")),
  randomUUID: vi.fn(() => "00000000-0000-0000-0000-000000000001"),
}));

import { introspectSchema } from "../sync/introspect-schema.js";
import { projectDesiredSchema } from "../sync/project-desired-schema.js";
import { diffSchema } from "../sync/diff-schema.js";

const mockIntrospect = introspectSchema as MockedFunction<typeof introspectSchema>;
const mockProject = projectDesiredSchema as MockedFunction<typeof projectDesiredSchema>;
const mockDiff = diffSchema as MockedFunction<typeof diffSchema>;

const emptySnapshot: DbSnapshot = { tables: [], enums: [], schemas: [] };
const emptyDesired: DesiredSchema = {
  tables: [],
  enums: [],
  schemas: [],
  extensions: [],
};
const emptyPlan: SyncPlan = {
  operations: [],
  summary: { safe: 0, warning: 0, destructive: 0, total: 0 },
};

const mockClient: PostgresQueryClient = {
  query: vi.fn().mockResolvedValue({ rows: [], rowCount: 0 }),
};

const fixedDate = new Date("2026-02-20T09:00:00.000Z");

let dir: string;

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), "proteus-gen-test-"));
  vi.clearAllMocks();
  mockProject.mockReturnValue(emptyDesired);
  mockIntrospect.mockResolvedValue(emptySnapshot);
  mockDiff.mockReturnValue(emptyPlan);
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

describe("generateMigration", () => {
  it("should orchestrate the full pipeline and write a file", async () => {
    const plan: SyncPlan = {
      operations: [
        {
          type: "add_column",
          severity: "safe",
          schema: "app",
          table: "users",
          description: 'Add column "email" to "app"."users"',
          sql: 'ALTER TABLE "app"."users" ADD COLUMN "email" TEXT;',
          autocommit: false,
        },
      ],
      summary: { safe: 1, warning: 0, destructive: 0, total: 1 },
    };
    mockDiff.mockReturnValue(plan);

    const result = await generateMigration(
      mockClient,
      [],
      { namespace: null },
      {
        directory: dir,
        name: "add-email",
        timestamp: fixedDate,
      },
    );

    expect(result.operationCount).toBe(1);
    expect(result.isEmpty).toBe(false);
    expect(result.filepath).toBe(join(dir, "20260220090000-add-email.ts"));
    expect(result.migration.id).toBe("00000000-0000-0000-0000-000000000001");

    const content = await readFile(result.filepath!, "utf-8");
    expect(content).toMatchSnapshot();
  });

  it("should report isEmpty for empty plan", async () => {
    const result = await generateMigration(
      mockClient,
      [],
      { namespace: null },
      {
        directory: dir,
        timestamp: fixedDate,
      },
    );

    expect(result.operationCount).toBe(0);
    expect(result.isEmpty).toBe(true);
  });

  it("should exclude warn_only from operation count", async () => {
    const plan: SyncPlan = {
      operations: [
        {
          type: "add_column",
          severity: "safe",
          schema: "app",
          table: "users",
          description: 'Add column "x" to "app"."users"',
          sql: 'ALTER TABLE "app"."users" ADD COLUMN "x" TEXT;',
          autocommit: false,
        },
        {
          type: "warn_only",
          severity: "warning",
          schema: "app",
          table: null,
          description: "Stale enum value",
          sql: "",
          autocommit: false,
        },
      ],
      summary: { safe: 1, warning: 1, destructive: 0, total: 2 },
    };
    mockDiff.mockReturnValue(plan);

    const result = await generateMigration(
      mockClient,
      [],
      { namespace: null },
      {
        directory: dir,
        timestamp: fixedDate,
      },
    );

    expect(result.operationCount).toBe(1);
    expect(result.isEmpty).toBe(false);
  });

  it("should pass managed tables to introspectSchema", async () => {
    const desired: DesiredSchema = {
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
        {
          schema: "app",
          name: "orgs",
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
    mockProject.mockReturnValue(desired);

    await generateMigration(
      mockClient,
      [],
      { namespace: null },
      {
        directory: dir,
        timestamp: fixedDate,
      },
    );

    expect(mockIntrospect).toHaveBeenCalledWith(mockClient, [
      { schema: "app", name: "users" },
      { schema: "app", name: "orgs" },
    ]);
  });
});
