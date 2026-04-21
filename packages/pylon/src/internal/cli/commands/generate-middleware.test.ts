import { resolve, join } from "path";
import { generateMiddleware } from "./generate-middleware";
import { beforeEach, describe, expect, it, vi } from "vitest";

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

const { mkdir, writeFile } =
  await vi.importMock<typeof import("fs/promises")>("fs/promises");
const { Logger } =
  await vi.importMock<typeof import("@lindorm/logger")>("@lindorm/logger");

describe("generateMiddleware", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should create _middleware.ts file for http type by default", async () => {
    const dir = resolve(process.cwd(), "./src/routes");

    await generateMiddleware("/v1/admin", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(dir, "v1", "admin", "_middleware.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should use PylonHttpMiddleware type for http", async () => {
    await generateMiddleware("/v1/admin", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("ServerHttpMiddleware");
    expect(content).not.toContain("ServerSocketMiddleware");
  });

  it("should use PylonSocketMiddleware type for socket", async () => {
    await generateMiddleware("chat", { socket: true });

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("ServerSocketMiddleware");
    expect(content).not.toContain("ServerHttpMiddleware");
  });

  it("should default to ./src/listeners directory for socket type", async () => {
    const dir = resolve(process.cwd(), "./src/listeners");

    await generateMiddleware("chat", { socket: true });

    expect(writeFile).toHaveBeenCalledWith(
      join(dir, "chat", "_middleware.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should default to ./src/routes directory for http type", async () => {
    const dir = resolve(process.cwd(), "./src/routes");

    await generateMiddleware("/v1/admin", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(dir, "v1", "admin", "_middleware.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should use custom directory when provided", async () => {
    const customDir = resolve(process.cwd(), "./custom");

    await generateMiddleware("/v1/admin", { directory: "./custom" });

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "v1", "admin", "_middleware.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should export MIDDLEWARE array", async () => {
    await generateMiddleware("/v1/admin", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const MIDDLEWARE = [middleware]");
  });

  it("should include next() call", async () => {
    await generateMiddleware("/v1/admin", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("await next()");
  });

  it("should strip leading slash from path", async () => {
    const dir = resolve(process.cwd(), "./src/routes");

    await generateMiddleware("/v1/admin", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(dir, "v1", "admin", "_middleware.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    const dir = resolve(process.cwd(), "./src/routes");

    await generateMiddleware("/v1/admin", {});

    expect(mkdir).toHaveBeenCalledWith(join(dir, "v1", "admin"), { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateMiddleware("/v1/admin", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateMiddleware("/v1/admin", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("ServerHttpMiddleware"),
    );
  });

  it("should log success message", async () => {
    await generateMiddleware("/v1/admin", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created middleware"),
    );
  });

  it("should log type as http", async () => {
    await generateMiddleware("/v1/admin", {});

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("http"));
  });

  it("should log type as socket", async () => {
    await generateMiddleware("chat", { socket: true });

    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("socket"));
  });

  it("should prompt for path when not provided", async () => {
    const mockInput = vi.fn().mockResolvedValue("/v1/admin");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateMiddleware: freshGenerate } = await import("./generate-middleware");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("Path"),
      }),
    );
  });
});
