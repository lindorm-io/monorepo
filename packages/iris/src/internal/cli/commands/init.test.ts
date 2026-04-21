import { resolve, join } from "path";
import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { init } from "./init.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("fs/promises", async () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("@lindorm/logger", () => ({
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

const mkdir = _mkdir as unknown as Mock;
const writeFile = _writeFile as unknown as Mock;
const Logger = _Logger as unknown as { std: Record<string, Mock> };

const defaultDir = resolve(process.cwd(), "./src/iris");

describe("init", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const mockSelect = vi.fn().mockResolvedValue("redis");
    vi.doMock("@inquirer/prompts", () => ({ select: mockSelect }));

    vi.resetModules();
    const { init: freshInit } = await import("./init.js");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
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
