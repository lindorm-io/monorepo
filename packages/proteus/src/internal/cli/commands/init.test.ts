import { resolve, join } from "path";
import { init } from "./init";

jest.mock("fs/promises", () => ({
  mkdir: jest.fn().mockResolvedValue(undefined),
  writeFile: jest.fn().mockResolvedValue(undefined),
}));

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

const { mkdir, writeFile } = jest.requireMock("fs/promises");
const { Logger } = jest.requireMock("@lindorm/logger");

const defaultDir = resolve(process.cwd(), "./src/proteus");

describe("init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create source.ts for postgres driver", async () => {
    await init({ driver: "postgres" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "postgres"'),
      "utf-8",
    );
  });

  it("should create source.ts for mysql driver", async () => {
    await init({ driver: "mysql" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "mysql"'),
      "utf-8",
    );
  });

  it("should create source.ts for sqlite driver", async () => {
    await init({ driver: "sqlite" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "sqlite"'),
      "utf-8",
    );
  });

  it("should create source.ts for redis driver", async () => {
    await init({ driver: "redis" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "redis"'),
      "utf-8",
    );
  });

  it("should create source.ts for mongo driver", async () => {
    await init({ driver: "mongo" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "mongo"'),
      "utf-8",
    );
  });

  it("should create source.ts for memory driver", async () => {
    await init({ driver: "memory" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "memory"'),
      "utf-8",
    );
  });

  it("should include postgres-specific config", async () => {
    await init({ driver: "postgres" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("port: 5432");
    expect(content).toContain('database: "app"');
  });

  it("should include mysql-specific config", async () => {
    await init({ driver: "mysql" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("port: 3306");
  });

  it("should include sqlite-specific config", async () => {
    await init({ driver: "sqlite" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain('filename: "./data/app.db"');
  });

  it("should include redis-specific config", async () => {
    await init({ driver: "redis" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("port: 6379");
  });

  it("should include mongo-specific config", async () => {
    await init({ driver: "mongo" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("port: 27017");
  });

  it("should create entities directory", async () => {
    await init({ driver: "postgres" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "entities", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should create migrations directory for SQL drivers", async () => {
    await init({ driver: "postgres" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "migrations", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should not create migrations directory for redis", async () => {
    await init({ driver: "redis" });

    const migrationCalls = writeFile.mock.calls.filter((c: Array<unknown>) =>
      (c[0] as string).includes("migrations"),
    );

    expect(migrationCalls).toHaveLength(0);
  });

  it("should not create migrations directory for mongo", async () => {
    await init({ driver: "mongo" });

    const migrationCalls = writeFile.mock.calls.filter((c: Array<unknown>) =>
      (c[0] as string).includes("migrations"),
    );

    expect(migrationCalls).toHaveLength(0);
  });

  it("should not create migrations directory for memory", async () => {
    await init({ driver: "memory" });

    const migrationCalls = writeFile.mock.calls.filter((c: Array<unknown>) =>
      (c[0] as string).includes("migrations"),
    );

    expect(migrationCalls).toHaveLength(0);
  });

  it("should use custom directory when provided", async () => {
    await init({ driver: "postgres", directory: "./custom/path" });

    const customDir = resolve(process.cwd(), "./custom/path");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "source.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should throw on unknown driver", async () => {
    await expect(init({ driver: "oracle" })).rejects.toThrow("Unknown driver: oracle");
  });

  it("should not write files in dry-run mode", async () => {
    await init({ driver: "postgres", dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file paths in dry-run mode", async () => {
    await init({ driver: "postgres", dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("source.ts"));
  });

  it("should prompt for driver when not provided", async () => {
    const mockSelect = jest.fn().mockResolvedValue("redis");
    jest.doMock("@inquirer/prompts", () => ({ select: mockSelect }));

    // Re-import to pick up the dynamic mock
    jest.resetModules();
    const { init: freshInit } = await import("./init");

    // Re-mock fs/promises and logger for the fresh module
    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshInit({});

    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Select database driver:",
      }),
    );
  });

  it("should create directories with mkdir recursive", async () => {
    await init({ driver: "memory" });

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should log success message", async () => {
    await init({ driver: "postgres" });

    expect(Logger.std.info).toHaveBeenCalledWith(expect.stringContaining("postgres"));
  });
});
