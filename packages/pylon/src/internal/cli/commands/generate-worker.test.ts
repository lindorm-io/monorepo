import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { resolve, join } from "path";
import { generateWorker } from "./generate-worker.js";
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
const Logger = _Logger as unknown as {
  std: {
    log: Mock;
    info: Mock;
    success: Mock;
    warn: Mock;
    error: Mock;
    debug: Mock;
  };
};

const defaultDir = resolve(process.cwd(), "./src/workers");

describe("generateWorker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create worker file with kebab-case filename from PascalCase name", async () => {
    await generateWorker("HeartbeatWorker", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "heartbeat-worker.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file content matching snapshot", async () => {
    await generateWorker("HeartbeatWorker", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toMatchSnapshot();
  });

  it("should generate cron file content matching snapshot", async () => {
    await generateWorker("HeartbeatWorker", { cron: "0 0 * * *" });

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toMatchSnapshot();
  });

  it("should export CRON instead of INTERVAL when cron is provided", async () => {
    await generateWorker("HeartbeatWorker", { cron: "*/5 * * * *" });

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain(`export const CRON = "*/5 * * * *";`);
    expect(content).not.toContain("export const INTERVAL");
  });

  it("should export INTERVAL and no CRON when cron is absent", async () => {
    await generateWorker("HeartbeatWorker", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain(`export const INTERVAL = "5m";`);
    expect(content).not.toContain("export const CRON");
  });

  it("should reject an invalid cron expression", async () => {
    await expect(
      generateWorker("HeartbeatWorker", { cron: "not-a-cron" }),
    ).rejects.toThrow("Invalid cron expression: not-a-cron");
  });

  it("should reject an empty cron expression", async () => {
    await expect(generateWorker("HeartbeatWorker", { cron: "" })).rejects.toThrow(
      "Invalid cron expression:",
    );
  });

  it("should not write files when the cron expression is invalid", async () => {
    await expect(
      generateWorker("HeartbeatWorker", { cron: "not-a-cron" }),
    ).rejects.toThrow();

    expect(mkdir).not.toHaveBeenCalled();
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should reject an invalid cron expression in dry-run mode", async () => {
    await expect(
      generateWorker("HeartbeatWorker", { cron: "not-a-cron", dryRun: true }),
    ).rejects.toThrow("Invalid cron expression: not-a-cron");

    expect(Logger.std.log).not.toHaveBeenCalled();
  });

  it("should log cron content in dry-run mode", async () => {
    await generateWorker("HeartbeatWorker", { cron: "0 0 * * *", dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining(`export const CRON = "0 0 * * *";`),
    );
    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should handle already-kebab-case name", async () => {
    await generateWorker("heartbeat-worker", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "heartbeat-worker.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should use custom directory when provided", async () => {
    await generateWorker("HeartbeatWorker", { directory: "./custom/workers" });

    const customDir = resolve(process.cwd(), "./custom/workers");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "heartbeat-worker.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateWorker("HeartbeatWorker", {});

    expect(mkdir).toHaveBeenCalledWith(defaultDir, { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateWorker("HeartbeatWorker", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateWorker("HeartbeatWorker", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("LindormWorkerCallback"),
    );
  });

  it("should log success message", async () => {
    await generateWorker("HeartbeatWorker", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created worker"),
    );
  });

  it("should prompt for name when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("HeartbeatWorker");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateWorker: freshGenerate } = await import("./generate-worker.js");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Worker name"),
      }),
    );
  });
});
