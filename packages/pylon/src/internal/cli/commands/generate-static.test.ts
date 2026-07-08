import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { resolve, join } from "path";
import { generateStatic } from "./generate-static.js";
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

describe("generateStatic", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create static route file at correct path for a simple path", async () => {
    await generateStatic("/assets", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "assets.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create static route file at correct path for a nested path", async () => {
    await generateStatic("/v1/files", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "files.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file content matching snapshot", async () => {
    await generateStatic("/assets", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toMatchSnapshot();
  });

  it("should use custom directory when provided", async () => {
    await generateStatic("/assets", { directory: "./custom/routes" });

    const customDir = resolve(process.cwd(), "./custom/routes");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "assets.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateStatic("/v1/files", {});

    expect(mkdir).toHaveBeenCalledWith(join(defaultDir, "v1"), { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateStatic("/assets", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateStatic("/assets", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("useStatic"));
  });

  it("should log success message", async () => {
    await generateStatic("/assets", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created static route"),
    );
  });

  it("should prompt for path when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("/assets");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateStatic: freshGenerate } = await import("./generate-static.js");

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
