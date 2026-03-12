import { resolve } from "path";
import { migrateRun } from "./migrate-run";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";
import { formatApplyResult } from "../output/format-migration-result";
import { Logger } from "@lindorm/logger";

jest.mock("../with-source");
jest.mock("../with-migration-manager");
jest.mock("../output/format-migration-result");

jest.mock("@lindorm/logger", () => ({
  Logger: {
    std: {
      log: jest.fn(),
      info: jest.fn(),
      success: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    },
  },
}));

const mockWithSource = withSource as jest.MockedFunction<typeof withSource>;
const mockWithMigrationManager = withMigrationManager as jest.MockedFunction<
  typeof withMigrationManager
>;
const mockFormatApplyResult = formatApplyResult as jest.MockedFunction<
  typeof formatApplyResult
>;

const defaultDir = resolve(process.cwd(), "./migrations");

const makeSource = (overrides: Record<string, unknown> = {}) => ({
  namespace: "myapp",
  driverType: "postgres",
  migrationsTable: undefined as string | undefined,
  getEntityMetadata: jest.fn().mockReturnValue([]),
  log: { child: jest.fn().mockReturnValue({ debug: jest.fn() }) },
  ...overrides,
});

const makeManager = () => ({
  apply: jest.fn().mockResolvedValue({
    applied: [{ name: "20240101-add-users", durationMs: 55 }],
    skipped: 0,
  }),
  rollback: jest.fn(),
  status: jest.fn(),
  getRecords: jest.fn(),
  resolveApplied: jest.fn(),
  resolveRolledBack: jest.fn(),
});

describe("migrateRun", () => {
  let manager: ReturnType<typeof makeManager>;

  beforeEach(() => {
    jest.clearAllMocks();
    manager = makeManager();

    mockWithSource.mockImplementation(async (_opts, fn) => {
      await fn({ source: makeSource() } as any);
    });

    mockWithMigrationManager.mockImplementation(async (_source, _dir, fn) => {
      await fn({ source: makeSource(), manager } as any);
    });

    mockFormatApplyResult.mockReturnValue(
      "Applied: 20240101-add-users (55ms)\n1 migration(s) applied.",
    );
  });

  it("should call withSource with provided options", async () => {
    await migrateRun({ source: "/config.ts" });

    expect(mockWithSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should call withMigrationManager with resolved directory", async () => {
    await migrateRun({ source: "/config.ts" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      defaultDir,
      expect.any(Function),
    );
  });

  it("should use options.directory when provided", async () => {
    await migrateRun({ source: "/config.ts", directory: "./custom" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      resolve(process.cwd(), "./custom"),
      expect.any(Function),
    );
  });

  it("should call apply on the manager", async () => {
    await migrateRun({ source: "/config.ts" });

    expect(manager.apply).toHaveBeenCalled();
  });

  it("should log 'no pending migrations' when result is empty", async () => {
    manager.apply.mockResolvedValue({ applied: [], skipped: 0 });

    await migrateRun({ source: "/config.ts" });

    expect(Logger.std.log).toHaveBeenCalledWith("No pending migrations to apply.");
    expect(mockFormatApplyResult).not.toHaveBeenCalled();
  });

  it("should format and log the apply result when migrations were applied", async () => {
    await migrateRun({ source: "/config.ts" });

    expect(mockFormatApplyResult).toHaveBeenCalledWith(
      [{ name: "20240101-add-users", durationMs: 55 }],
      0,
      defaultDir,
    );
    expect(Logger.std.log).toHaveBeenCalledWith(
      "Applied: 20240101-add-users (55ms)\n1 migration(s) applied.",
    );
  });
});
