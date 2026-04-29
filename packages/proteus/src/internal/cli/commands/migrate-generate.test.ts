import { resolve } from "path";
import { migrateGenerate } from "./migrate-generate.js";
import { withSource } from "../with-source.js";
import { withMigrationManager } from "../with-migration-manager.js";
import { Logger } from "@lindorm/logger";
import { beforeEach, describe, expect, it, vi, type MockedFunction } from "vitest";

vi.mock("../with-source.js");
vi.mock("../with-migration-manager.js");

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

const defaultDir = resolve(process.cwd(), "./migrations");

const makeSource = (overrides: Record<string, unknown> = {}) => ({
  namespace: "myapp",
  driverType: "postgres",
  migrationsTable: undefined,
  getEntityMetadata: vi.fn().mockReturnValue([]),
  log: { child: vi.fn().mockReturnValue({ debug: vi.fn() }) },
  client: vi.fn(),
  ...overrides,
});

const makeManager = () => ({
  apply: vi.fn(),
  rollback: vi.fn(),
  status: vi.fn(),
  getRecords: vi.fn(),
  resolveApplied: vi.fn(),
  resolveRolledBack: vi.fn(),
  generateBaseline: vi.fn(),
  generateMigration: vi.fn().mockResolvedValue({
    filepath: `${defaultDir}/20240101_generated.ts`,
    operationCount: 1,
    isEmpty: false,
  }),
});

describe("migrateGenerate", () => {
  let source: ReturnType<typeof makeSource>;
  let manager: ReturnType<typeof makeManager>;

  beforeEach(() => {
    vi.clearAllMocks();
    source = makeSource();
    manager = makeManager();

    mockWithSource.mockImplementation(async (_opts, fn) => {
      await fn({ source } as any);
    });

    mockWithMigrationManager.mockImplementation(async (_source, _dir, fn) => {
      await fn({ source, manager } as any);
    });
  });

  it("should call withSource with provided options", async () => {
    await migrateGenerate({ name: "generated", source: "/config.ts" });

    expect(mockWithSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should load entities from source", async () => {
    await migrateGenerate({ name: "generated", source: "/config.ts" });

    expect(source.getEntityMetadata).toHaveBeenCalled();
  });

  it("should call generateMigration with metadataList and options", async () => {
    await migrateGenerate({ name: "my-migration", source: "/config.ts" });

    expect(manager.generateMigration).toHaveBeenCalledWith(
      [],
      { namespace: "myapp" },
      { name: "my-migration", writeFile: true },
    );
  });

  it("should pass writeFile: false when dryRun is true", async () => {
    await migrateGenerate({ name: "generated", source: "/config.ts", dryRun: true });

    expect(manager.generateMigration).toHaveBeenCalledWith(
      expect.anything(),
      expect.anything(),
      expect.objectContaining({ writeFile: false }),
    );
  });

  it("should log 'no changes' when result is empty", async () => {
    manager.generateMigration.mockResolvedValue({
      filepath: null,
      operationCount: 0,
      isEmpty: true,
    });

    await migrateGenerate({ name: "generated", source: "/config.ts" });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("No schema changes detected"),
    );
  });

  it("should log dry run message when dryRun is true and changes exist", async () => {
    manager.generateMigration.mockResolvedValue({
      filepath: null,
      operationCount: 1,
      isEmpty: false,
    });

    await migrateGenerate({ name: "generated", source: "/config.ts", dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("should log filename, location, and operation count after writing", async () => {
    manager.generateMigration.mockResolvedValue({
      filepath: `${defaultDir}/20240101_generated.ts`,
      operationCount: 2,
      isEmpty: false,
    });

    await migrateGenerate({ name: "my-migration", source: "/config.ts" });

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("20240101_generated.ts"),
    );
    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("20240101_generated.ts"),
    );
    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("2"));
  });

  it("should use options.directory when provided", async () => {
    await migrateGenerate({
      name: "generated",
      source: "/config.ts",
      directory: "./custom",
    });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      resolve(process.cwd(), "./custom"),
      expect.any(Function),
    );
  });

  it("should throw for interactive mode on non-postgres driver", async () => {
    source = makeSource({ driverType: "mysql" });
    mockWithSource.mockImplementation(async (_opts, fn) => {
      await fn({ source } as any);
    });

    await expect(
      migrateGenerate({ name: "generated", source: "/config.ts", interactive: true }),
    ).rejects.toThrow("Interactive generate is only available for the postgres driver");
  });

  it("should throw when generateMigration is not supported", async () => {
    const managerWithout = { ...manager, generateMigration: undefined };
    mockWithMigrationManager.mockImplementation(async (_source, _dir, fn) => {
      await fn({
        source: makeSource({ driverType: "redis" }),
        manager: managerWithout,
      } as any);
    });

    await expect(
      migrateGenerate({ name: "generated", source: "/config.ts" }),
    ).rejects.toThrow('"migrate generate" is not supported');
  });
});
