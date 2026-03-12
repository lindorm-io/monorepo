import { resolve } from "path";
import { migrateGenerate } from "./migrate-generate";
import { withSource } from "../with-source";
import { withMigrationManager } from "../with-migration-manager";
import { Logger } from "@lindorm/logger";

jest.mock("../with-source");
jest.mock("../with-migration-manager");

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

const defaultDir = resolve(process.cwd(), "./migrations");

const makeSource = (overrides: Record<string, unknown> = {}) => ({
  namespace: "myapp",
  driverType: "postgres",
  migrationsTable: undefined,
  getEntityMetadata: jest.fn().mockReturnValue([]),
  log: { child: jest.fn().mockReturnValue({ debug: jest.fn() }) },
  client: jest.fn(),
  ...overrides,
});

const makeManager = () => ({
  apply: jest.fn(),
  rollback: jest.fn(),
  status: jest.fn(),
  getRecords: jest.fn(),
  resolveApplied: jest.fn(),
  resolveRolledBack: jest.fn(),
  generateBaseline: jest.fn(),
  generateMigration: jest.fn().mockResolvedValue({
    filepath: `${defaultDir}/20240101_generated.ts`,
    operationCount: 1,
    isEmpty: false,
  }),
});

describe("migrateGenerate", () => {
  let source: ReturnType<typeof makeSource>;
  let manager: ReturnType<typeof makeManager>;

  beforeEach(() => {
    jest.clearAllMocks();
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
