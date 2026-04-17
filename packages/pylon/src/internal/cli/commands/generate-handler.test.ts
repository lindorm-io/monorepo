import { resolve, join } from "path";
import { generateHandler } from "./generate-handler";

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

const defaultDir = resolve(process.cwd(), "./src/handlers");

describe("generateHandler", () => {
  beforeEach(() => {
    jest.clearAllMocks();
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

    expect(content).toContain('import { z } from "zod/v4"');
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
    const mockInput = jest.fn().mockResolvedValue("getUser");
    jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    jest.resetModules();
    const { generateHandler: freshGenerate } = await import("./generate-handler");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Handler name"),
      }),
    );
  });
});
