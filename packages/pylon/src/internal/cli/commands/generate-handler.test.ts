import { resolve, join } from "path";
import { loadLindormConfig as _loadLindormConfig } from "@lindorm/scaffold";
import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { generateHandler } from "./generate-handler.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

vi.mock("fs/promises", async () => ({
  mkdir: vi.fn().mockResolvedValue(undefined),
  writeFile: vi.fn().mockResolvedValue(undefined),
}));

// Keep resolveTarget + LINDORM_CONFIG_DEFAULTS real; only stub the config read.
vi.mock("@lindorm/scaffold", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@lindorm/scaffold")>()),
  loadLindormConfig: vi.fn().mockResolvedValue(null),
}));

const loadLindormConfig = _loadLindormConfig as unknown as Mock;

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

const defaultDir = resolve(process.cwd(), "./src/handlers");

describe("generateHandler", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create handler file with camelCase name", async () => {
    await generateHandler("GetUser", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "getUser.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should generate file with camelCase schema export", async () => {
    await generateHandler("GetUser", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const getUserSchema = z.object(");
  });

  it("should generate file with typed handler export", async () => {
    await generateHandler("GetUser", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain(
      "export const getUser: ServerHandler<typeof getUserSchema>",
    );
  });

  it("should import zod and ServerHandler type", async () => {
    await generateHandler("GetUser", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain('import { z } from "zod"');
    expect(content).toContain('import type { ServerHandler } from "../types/context"');
  });

  it("should handle already-camelCase name", async () => {
    await generateHandler("getUser", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "getUser.ts"),
      expect.any(String),
      "utf-8",
    );

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const getUserSchema");
    expect(content).toContain("export const getUser: ServerHandler<");
  });

  it("should use custom directory when provided", async () => {
    await generateHandler("GetUser", { directory: "./custom/handlers" });

    const customDir = resolve(process.cwd(), "./custom/handlers");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "getUser.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should use lindorm.config handlersDir when no directory arg is given", async () => {
    loadLindormConfig.mockResolvedValueOnce({
      pylon: { handlersDir: "./from/config/handlers" },
    });

    await generateHandler("GetUser", {});

    const configDir = resolve(process.cwd(), "./from/config/handlers");

    expect(writeFile).toHaveBeenCalledWith(
      join(configDir, "getUser.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should let the --directory arg win over lindorm.config", async () => {
    loadLindormConfig.mockResolvedValueOnce({
      pylon: { handlersDir: "./from/config/handlers" },
    });

    await generateHandler("GetUser", { directory: "./from/arg" });

    const argDir = resolve(process.cwd(), "./from/arg");

    expect(writeFile).toHaveBeenCalledWith(
      join(argDir, "getUser.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateHandler("GetUser", {});

    expect(mkdir).toHaveBeenCalledWith(defaultDir, { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateHandler("GetUser", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateHandler("GetUser", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("ServerHandler"));
  });

  it("should log success message", async () => {
    await generateHandler("GetUser", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created handler"),
    );
  });

  it("should prompt for name when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("getUser");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateHandler: freshGenerate } = await import("./generate-handler.js");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Handler name"),
      }),
    );
  });
});
