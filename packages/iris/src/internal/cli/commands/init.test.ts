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

const defaultDir = resolve(process.cwd(), "./src/iris");

describe("init", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create source.ts for rabbit driver", async () => {
    await init({ driver: "rabbit" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "rabbit"'),
      "utf-8",
    );
  });

  it("should create source.ts for kafka driver", async () => {
    await init({ driver: "kafka" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "kafka"'),
      "utf-8",
    );
  });

  it("should create source.ts for nats driver", async () => {
    await init({ driver: "nats" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "source.ts"),
      expect.stringContaining('driver: "nats"'),
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

  it("should include rabbit-specific config", async () => {
    await init({ driver: "rabbit" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("amqp://localhost:5672");
  });

  it("should include kafka-specific config", async () => {
    await init({ driver: "kafka" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain('brokers: ["localhost:9092"]');
  });

  it("should include nats-specific config", async () => {
    await init({ driver: "nats" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("localhost:4222");
  });

  it("should include redis-specific config", async () => {
    await init({ driver: "redis" });

    const content = writeFile.mock.calls.find((c: Array<unknown>) =>
      (c[0] as string).endsWith("source.ts"),
    )?.[1] as string;

    expect(content).toContain("redis://localhost:6379");
  });

  it("should create messages directory", async () => {
    await init({ driver: "rabbit" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "messages", ".gitkeep"),
      "",
      "utf-8",
    );
  });

  it("should use custom directory when provided", async () => {
    await init({ driver: "rabbit", directory: "./custom/path" });

    const customDir = resolve(process.cwd(), "./custom/path");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "source.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should throw on unknown driver", async () => {
    await expect(init({ driver: "zeromq" })).rejects.toThrow("Unknown driver: zeromq");
  });

  it("should not write files in dry-run mode", async () => {
    await init({ driver: "rabbit", dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log file paths in dry-run mode", async () => {
    await init({ driver: "rabbit", dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("source.ts"));
  });

  it("should prompt for driver when not provided", async () => {
    const mockSelect = jest.fn().mockResolvedValue("redis");
    jest.doMock("@inquirer/prompts", () => ({ select: mockSelect }));

    jest.resetModules();
    const { init: freshInit } = await import("./init");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshInit({});

    expect(mockSelect).toHaveBeenCalledWith(
      expect.objectContaining({
        message: "Select messaging driver:",
      }),
    );
  });

  it("should create directories with mkdir recursive", async () => {
    await init({ driver: "rabbit" });

    expect(mkdir).toHaveBeenCalledWith(expect.any(String), { recursive: true });
  });

  it("should log success message", async () => {
    await init({ driver: "rabbit" });

    expect(Logger.std.info).toHaveBeenCalledWith(expect.stringContaining("rabbit"));
  });
});
