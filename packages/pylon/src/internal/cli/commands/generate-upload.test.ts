import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { resolve, join } from "path";
import { generateUpload } from "./generate-upload.js";
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

const defaultDir = resolve(process.cwd(), "./src/routes");

describe("generateUpload", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create upload route file at correct path for a simple path", async () => {
    await generateUpload("/assets", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "assets.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create upload route file at correct path for a nested path", async () => {
    await generateUpload("/v1/files", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "files.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file content matching snapshot", async () => {
    await generateUpload("/assets", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toMatchSnapshot();
  });

  it("should use custom directory when provided", async () => {
    await generateUpload("/assets", { directory: "./custom/routes" });

    const customDir = resolve(process.cwd(), "./custom/routes");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "assets.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateUpload("/v1/files", {});

    expect(mkdir).toHaveBeenCalledWith(join(defaultDir, "v1"), { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateUpload("/assets", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateUpload("/assets", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("useUpload"));
  });

  it("should log success message", async () => {
    await generateUpload("/assets", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created upload route"),
    );
  });

  it("should prompt for path when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("/assets");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateUpload: freshGenerate } = await import("./generate-upload.js");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("URL path"),
      }),
    );
  });
});
