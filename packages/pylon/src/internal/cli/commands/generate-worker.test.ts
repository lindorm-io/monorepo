import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { resolve, join } from "path";
import { generateWorker } from "./generate-worker";
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
    const { generateWorker: freshGenerate } = await import("./generate-worker");

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
