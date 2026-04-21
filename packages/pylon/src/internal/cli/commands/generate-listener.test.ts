import { resolve, join } from "path";
import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { generateListener } from "./generate-listener";
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

const defaultDir = resolve(process.cwd(), "./src/listeners");

describe("generateListener", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create listener file at correct path", async () => {
    await generateListener("ON", "chat:message", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "chat", "message.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should convert colon-separated event to file path", async () => {
    await generateListener("ON", "user:status:update", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "user", "status", "update.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should export ON binding", async () => {
    await generateListener("ON", "chat:message", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const ON: Array<ServerSocketMiddleware>");
    expect(content).not.toContain("export const ONCE");
  });

  it("should export ONCE binding", async () => {
    await generateListener("ONCE", "chat:message", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const ONCE: Array<ServerSocketMiddleware>");
    expect(content).not.toContain("export const ON:");
  });

  it("should export multiple bindings when comma-separated", async () => {
    await generateListener("ON,ONCE", "chat:message", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const ON: Array<ServerSocketMiddleware>");
    expect(content).toContain("export const ONCE: Array<ServerSocketMiddleware>");
  });

  it("should calculate correct relative import path for types", async () => {
    await generateListener("ON", "chat:message", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain('from "../../types/context"');
  });

  it("should use custom directory when provided", async () => {
    await generateListener("ON", "chat:message", { directory: "./custom/listeners" });

    const customDir = resolve(process.cwd(), "./custom/listeners");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "chat", "message.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateListener("ON", "chat:message", {});

    expect(mkdir).toHaveBeenCalledWith(join(defaultDir, "chat"), { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateListener("ON", "chat:message", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateListener("ON", "chat:message", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("ServerSocketMiddleware"),
    );
  });

  it("should log success message", async () => {
    await generateListener("ON", "chat:message", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created listener"),
    );
  });

  it("should log bindings", async () => {
    await generateListener("ON", "chat:message", {});

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("ON"));
  });

  it("should handle simple event name without colons", async () => {
    await generateListener("ON", "disconnect", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "disconnect.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should throw on empty bindings", async () => {
    await expect(generateListener(",", "chat:message", {})).rejects.toThrow(
      "At least one binding is required",
    );
  });

  it("should throw on invalid binding", async () => {
    await expect(generateListener("INVALID", "chat:message", {})).rejects.toThrow(
      "Invalid binding: INVALID",
    );
  });

  it("should uppercase bindings", async () => {
    await generateListener("on", "chat:message", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const ON: Array<ServerSocketMiddleware>");
  });

  it("should prompt for bindings and event when not provided", async () => {
    const mockInput = vi
      .fn()
      .mockResolvedValueOnce("ON")
      .mockResolvedValueOnce("chat:message");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateListener: freshGenerate } = await import("./generate-listener");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Bindings"),
      }),
    );
    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Event name"),
      }),
    );
  });
});
