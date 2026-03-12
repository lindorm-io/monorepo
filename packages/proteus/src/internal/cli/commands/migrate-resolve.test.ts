import { resolve } from "path";
import { migrateResolve } from "./migrate-resolve";
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
  resolveApplied: jest.fn().mockResolvedValue(undefined),
  resolveRolledBack: jest.fn().mockResolvedValue(undefined),
});

describe("migrateResolve", () => {
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
  });

  it("should throw when neither --applied nor --rolled-back is provided", async () => {
    await expect(migrateResolve({ source: "/config.ts" })).rejects.toThrow(
      "Exactly one of --applied or --rolled-back is required",
    );
  });

  it("should throw when both --applied and --rolled-back are provided", async () => {
    await expect(
      migrateResolve({
        source: "/config.ts",
        applied: "migration-a",
        rolledBack: "migration-a",
      }),
    ).rejects.toThrow("Cannot use both --applied and --rolled-back");
  });

  describe("--applied flow", () => {
    it("should call resolveApplied on the manager", async () => {
      await migrateResolve({ source: "/config.ts", applied: "20240101-add-users" });

      expect(manager.resolveApplied).toHaveBeenCalledWith(
        "20240101-add-users",
        defaultDir,
      );
    });

    it("should log success message", async () => {
      await migrateResolve({ source: "/config.ts", applied: "20240101-add-users" });

      expect(Logger.std.info).toHaveBeenCalledWith(
        expect.stringContaining("Marked migration as applied: 20240101-add-users"),
      );
    });

    it("should use options.directory when provided", async () => {
      await migrateResolve({
        source: "/config.ts",
        applied: "20240101-add-users",
        directory: "./custom",
      });

      expect(mockWithMigrationManager).toHaveBeenCalledWith(
        expect.anything(),
        resolve(process.cwd(), "./custom"),
        expect.any(Function),
      );
    });

    it("should propagate errors from resolveApplied", async () => {
      manager.resolveApplied.mockRejectedValue(
        new Error("Migration file not found: non-existent"),
      );

      await expect(
        migrateResolve({ source: "/config.ts", applied: "non-existent" }),
      ).rejects.toThrow("Migration file not found: non-existent");
    });
  });

  describe("--rolled-back flow", () => {
    it("should call resolveRolledBack on the manager", async () => {
      await migrateResolve({ source: "/config.ts", rolledBack: "20240101-add-users" });

      expect(manager.resolveRolledBack).toHaveBeenCalledWith("20240101-add-users");
    });

    it("should log success message", async () => {
      await migrateResolve({ source: "/config.ts", rolledBack: "20240101-add-users" });

      expect(Logger.std.info).toHaveBeenCalledWith(
        expect.stringContaining("Marked migration as rolled back: 20240101-add-users"),
      );
    });

    it("should propagate errors from resolveRolledBack", async () => {
      manager.resolveRolledBack.mockRejectedValue(
        new Error(
          "Migration not found in tracking table or already rolled back: not-applied",
        ),
      );

      await expect(
        migrateResolve({ source: "/config.ts", rolledBack: "not-applied" }),
      ).rejects.toThrow(
        "Migration not found in tracking table or already rolled back: not-applied",
      );
    });
  });
});
