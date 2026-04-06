import { resolve, join } from "path";
import { generateRoute } from "./generate-route";

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

const defaultDir = resolve(process.cwd(), "./src/routes");

describe("generateRoute", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("should create route file at correct path", async () => {
    await generateRoute("GET", "/v1/users", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "users.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should convert :id params to [id] in file path", async () => {
    await generateRoute("GET", "/v1/users/:id", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "users", "[id].ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should convert *rest params to [...rest] in file path", async () => {
    await generateRoute("GET", "/v1/files/*path", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "files", "[...path].ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should split comma-separated methods into individual exports", async () => {
    await generateRoute("GET,POST", "/v1/users", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const GET: Array<ServerHttpMiddleware>");
    expect(content).toContain("export const POST: Array<ServerHttpMiddleware>");
  });

  it("should uppercase method names", async () => {
    await generateRoute("get,post", "/v1/users", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const GET: Array<ServerHttpMiddleware>");
    expect(content).toContain("export const POST: Array<ServerHttpMiddleware>");
  });

  it("should generate single method export", async () => {
    await generateRoute("DELETE", "/v1/users/:id", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain("export const DELETE: Array<ServerHttpMiddleware>");
    expect(content).not.toContain("export const GET");
  });

  it("should calculate correct relative import path for types", async () => {
    await generateRoute("GET", "/v1/users", {});

    const content = writeFile.mock.calls[0][1] as string;

    expect(content).toContain('import { useHandler } from "@lindorm/pylon"');
    expect(content).toContain('from "../../types/context"');
  });

  it("should use custom directory when provided", async () => {
    await generateRoute("GET", "/v1/users", { directory: "./custom/routes" });

    const customDir = resolve(process.cwd(), "./custom/routes");

    expect(writeFile).toHaveBeenCalledWith(
      join(customDir, "v1", "users.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should create parent directory with mkdir recursive", async () => {
    await generateRoute("GET", "/v1/users", {});

    expect(mkdir).toHaveBeenCalledWith(join(defaultDir, "v1"), { recursive: true });
  });

  it("should not write files in dry-run mode", async () => {
    await generateRoute("GET", "/v1/users", { dryRun: true });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should log content in dry-run mode", async () => {
    await generateRoute("GET", "/v1/users", { dryRun: true });

    expect(Logger.std.log).toHaveBeenCalledWith(
      expect.stringContaining("ServerHttpMiddleware"),
    );
  });

  it("should log success message", async () => {
    await generateRoute("GET", "/v1/users", {});

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created route"),
    );
  });

  it("should throw on empty methods", async () => {
    await expect(generateRoute(",", "/v1/users", {})).rejects.toThrow(
      "At least one HTTP method is required",
    );
  });

  it("should handle trailing slash as index.ts", async () => {
    await generateRoute("GET", "/v1/users/", {});

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "users", "index.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should prompt for methods when not provided", async () => {
    const mockInput = jest.fn().mockResolvedValue("GET");
    jest.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    jest.resetModules();
    const { generateRoute: freshGenerate } = await import("./generate-route");

    jest.doMock("fs/promises", () => ({
      mkdir: jest.fn().mockResolvedValue(undefined),
      writeFile: jest.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("HTTP methods"),
      }),
    );
  });
});
