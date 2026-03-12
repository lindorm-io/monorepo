import { resolve } from "path";
import { migrateBaseline } from "./migrate-baseline";
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
  migrationsTable: undefined as string | undefined,
  getEntityMetadata: jest.fn().mockReturnValue([]),
  log: { child: jest.fn().mockReturnValue({ debug: jest.fn() }) },
  ...overrides,
});

const makeManager = () => ({
  apply: jest.fn(),
  rollback: jest.fn(),
  status: jest.fn(),
  getRecords: jest.fn(),
  resolveApplied: jest.fn(),
  resolveRolledBack: jest.fn(),
  generateBaseline: jest.fn().mockResolvedValue({
    filepath: `${defaultDir}/20240101_baseline.ts`,
    operationCount: 5,
    markedAsApplied: false,
  }),
  generateMigration: jest.fn(),
});

describe("migrateBaseline", () => {
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

  it("should call withSource with the provided options", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(mockWithSource).toHaveBeenCalledWith(
      expect.objectContaining({ source: "/config.ts" }),
      expect.any(Function),
    );
  });

  it("should load entities from source", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(source.getEntityMetadata).toHaveBeenCalled();
  });

  it("should call withMigrationManager with resolved directory", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      defaultDir,
      expect.any(Function),
    );
  });

  it("should use options.directory when provided", async () => {
    await migrateBaseline({
      name: "baseline",
      source: "/config.ts",
      directory: "./custom-migrations",
    });

    expect(mockWithMigrationManager).toHaveBeenCalledWith(
      expect.anything(),
      resolve(process.cwd(), "./custom-migrations"),
      expect.any(Function),
    );
  });

  it("should call generateBaseline with metadataList and name", async () => {
    const metadataList = [{ target: class User {} }] as any;
    source.getEntityMetadata.mockReturnValue(metadataList);

    await migrateBaseline({ name: "my-baseline", source: "/config.ts" });

    expect(manager.generateBaseline).toHaveBeenCalledWith(
      metadataList,
      { namespace: "myapp" },
      { name: "my-baseline" },
    );
  });

  it("should log filename and filepath after generation", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("20240101_baseline.ts"),
    );
    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("20240101_baseline.ts"),
    );
  });

  it("should log operation count", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("5"));
  });

  it("should log marked as applied message when baseline matches schema", async () => {
    manager.generateBaseline.mockResolvedValue({
      filepath: `${defaultDir}/20240101_baseline.ts`,
      operationCount: 0,
      markedAsApplied: true,
    });

    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Baseline marked as applied"),
    );
  });

  it("should not log marked as applied message when markedAsApplied is false", async () => {
    await migrateBaseline({ name: "baseline", source: "/config.ts" });

    const infoCalls = (Logger.std.info as jest.Mock).mock.calls.map(
      (c: unknown[]) => c[0] as string,
    );
    expect(infoCalls.join("")).not.toContain("Baseline marked as applied");
  });

  it("should throw when generateBaseline is not supported", async () => {
    const managerWithout = { ...manager, generateBaseline: undefined };
    mockWithMigrationManager.mockImplementation(async (_source, _dir, fn) => {
      await fn({
        source: makeSource({ driverType: "redis" }),
        manager: managerWithout,
      } as any);
    });

    await expect(
      migrateBaseline({ name: "baseline", source: "/config.ts" }),
    ).rejects.toThrow('"migrate baseline" is not supported');
  });
});
