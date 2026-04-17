import { resolve, join } from "path";
import { generateWorker } from "./generate-worker";

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

const defaultDir = resolve(process.cwd(), "./src/workers");

describe("generateWorker", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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
    const mockInput = jest.fn().mockResolvedValue("HeartbeatWorker");
    jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    jest.resetModules();
    const { generateWorker: freshGenerate } = await import("./generate-worker");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Worker name"),
      }),
    );
  });
});
