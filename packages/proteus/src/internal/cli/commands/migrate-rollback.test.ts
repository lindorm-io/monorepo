import { resolve } from "path";
import { migrateRollback } from "./migrate-rollback";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";
import { formatRollbackResult } from "../output/format-migration-result";
import { Logger } from "@lindorm/logger";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("../with-source");
vi.mock("../with-migration-manager");
vi.mock("../output/format-migration-result");

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
const mockFormatRollbackResult = formatRollbackResult as MockedFunction<
  typeof formatRollbackResult
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
  rollback: vi.fn().mockResolvedValue({
    applied: [{ name: "20240101-add-users", durationMs: 42 }],
  }),
  status: vi.fn(),
  getRecords: vi.fn(),
  resolveApplied: vi.fn(),
  resolveRolledBack: vi.fn(),
});

describe("migrateRollback", () => {
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

    mockFormatRollbackResult.mockReturnValue("Rolled back: 20240101-add-users (42ms)");
  });

  it("should call withSource with provided options", async () => {
    await migrateRollback({ count: "1", source: "/config.ts" });

    expect(mockWithSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should call withMigrationManager with resolved directory", async () => {
    await migrateRollback({ count: "1", source: "/config.ts" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      defaultDir,
      expect.any(Function),
    );
  });

  it("should throw when count is not a valid integer", async () => {
    await expect(migrateRollback({ count: "abc", source: "/config.ts" })).rejects.toThrow(
      "--count must be a positive integer",
    );
  });

  it("should throw when count is zero", async () => {
    await expect(migrateRollback({ count: "0", source: "/config.ts" })).rejects.toThrow(
      "--count must be a positive integer",
    );
  });

  it("should throw when count is negative", async () => {
    await expect(migrateRollback({ count: "-1", source: "/config.ts" })).rejects.toThrow(
      "--count must be a positive integer",
    );
  });

  it("should call rollback on the manager with parsed count", async () => {
    await migrateRollback({ count: "3", source: "/config.ts" });

    expect(manager.rollback).toHaveBeenCalledWith(3);
  });

  it("should log 'no migrations to roll back' when result is empty", async () => {
    manager.rollback.mockResolvedValue({ applied: [] });

    await migrateRollback({ count: "1", source: "/config.ts" });

    expect(Logger.std.log).toHaveBeenCalledWith("No migrations to roll back.");
    expect(mockFormatRollbackResult).not.toHaveBeenCalled();
  });

  it("should format and log the rollback result", async () => {
    await migrateRollback({ count: "1", source: "/config.ts" });

    expect(mockFormatRollbackResult).toHaveBeenCalledWith(
      [{ name: "20240101-add-users", durationMs: 42 }],
      defaultDir,
    );
    expect(Logger.std.log).toHaveBeenCalledWith("Rolled back: 20240101-add-users (42ms)");
  });

  it("should use options.directory when provided", async () => {
    await migrateRollback({ count: "1", source: "/config.ts", directory: "./custom" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      resolve(process.cwd(), "./custom"),
      expect.any(Function),
    );
  });
});
