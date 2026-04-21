import { resolve } from "path";
import { migrateStatus } from "./migrate-status";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";
import { formatStatusTable } from "../output/format-status-table";
import { Logger } from "@lindorm/logger";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("../with-source");
vi.mock("../with-migration-manager");
vi.mock("../output/format-status-table");

vi.mock("@lindorm/logger", async () => ({
  Logger: {
    std: {
      log: vi.fn(),
      info: vi.fn(),
      success: vi.fn(),
      warn: vi.fn(),
      error: vi.fn(),
      debug: vi.fn(),
    },
  },
}));

const mockWithSource = withSource as MockedFunction<typeof withSource>;
const mockWithMigrationManager = withMigrationManager as MockedFunction<
  typeof withMigrationManager
>;
const mockFormatStatusTable = formatStatusTable as MockedFunction<
  typeof formatStatusTable
>;

const defaultDir = resolve(process.cwd(), "./migrations");

const makeSource = (overrides: Record<string, unknown> = {}) => ({
  namespace: "myapp",
  driverType: "postgres",
  migrationsTable: undefined as string | undefined,
  getEntityMetadata: vi.fn().mockReturnValue([]),
  log: { child: vi.fn().mockReturnValue({ debug: vi.fn() }) },
  ...overrides,
});

const makeManager = () => ({
  apply: vi.fn(),
  rollback: vi.fn(),
  status: vi.fn().mockResolvedValue({
    resolved: [
      { name: "20240101-add-users", status: "applied" },
      { name: "20240201-add-posts", status: "pending" },
    ],
    ghosts: [],
  }),
  getRecords: vi.fn(),
  resolveApplied: vi.fn(),
  resolveRolledBack: vi.fn(),
});

describe("migrateStatus", () => {
  let manager: ReturnType<typeof makeManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    manager = makeManager();

    mockWithSource.mockImplementation(async (_opts, fn) => {
      await fn({ source: makeSource() } as any);
    });

    mockWithMigrationManager.mockImplementation(async (_source, _dir, fn) => {
      await fn({ source: makeSource(), manager } as any);
    });

    mockFormatStatusTable.mockReturnValue("Migration Status Table output");
  });

  it("should call withSource with provided options", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(mockWithSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should call withMigrationManager with resolved directory", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      defaultDir,
      expect.any(Function),
    );
  });

  it("should use options.directory when provided", async () => {
    await migrateStatus({ source: "/config.ts", directory: "./custom" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      resolve(process.cwd(), "./custom"),
      expect.any(Function),
    );
  });

  it("should call status on the manager", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(manager.status).toHaveBeenCalled();
  });

  it("should pass resolved migrations as name/status pairs to formatStatusTable", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(mockFormatStatusTable).toHaveBeenCalledWith(
      [
        { name: "20240101-add-users", status: "applied" },
        { name: "20240201-add-posts", status: "pending" },
      ],
      [],
      defaultDir,
    );
  });

  it("should log the formatted status table output", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(Logger.std.log).toHaveBeenCalledWith("Migration Status Table output");
  });

  it("should pass directory to formatStatusTable", async () => {
    await migrateStatus({ source: "/config.ts" });

    expect(mockFormatStatusTable).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      defaultDir,
    );
  });

  it("should handle empty resolved migrations", async () => {
    manager.status.mockResolvedValue({ resolved: [], ghosts: [] });
    mockFormatStatusTable.mockReturnValue("No migrations found.");

    await migrateStatus({ source: "/config.ts" });

    expect(mockFormatStatusTable).toHaveBeenCalledWith([], [], defaultDir);
    expect(Logger.std.log).toHaveBeenCalledWith("No migrations found.");
  });
});
