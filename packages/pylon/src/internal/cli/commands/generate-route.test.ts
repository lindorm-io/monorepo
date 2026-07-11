import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { loadLindormConfig as _loadLindormConfig } from "@lindorm/scaffold";
import { Logger as _Logger } from "@lindorm/logger";
import { resolve, join } from "path";
import { generateRoute } from "./generate-route.js";
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

describe("generateRoute", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
    const mockInput = vi.fn().mockResolvedValue("GET");
    vi.doMock("@inquirer/prompts", () => ({ input: mockInput }));

    vi.resetModules();
    const { generateRoute: freshGenerate } = await import("./generate-route.js");

    vi.doMock("fs/promises", () => ({
      mkdir: vi.fn().mockResolvedValue(undefined),
      writeFile: vi.fn().mockResolvedValue(undefined),
    }));

    await freshGenerate(undefined, undefined, {});

    expect(mockInput).toHaveBeenCalledWith(
      expect.objectContaining({
        message: expect.stringContaining("HTTP methods"),
      }),
    );
  });
});

const defaultFeatureDir = resolve(process.cwd(), "./src/features");

describe("generateRoute --feature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should scaffold a per-method handler file + a wired route via the positional-less flags", async () => {
    await generateRoute(undefined, undefined, {
      feature: "user",
      methods: "get,post,put,delete",
      path: "/v1/users/[id]",
    });

    for (const name of ["get", "create", "update", "delete"]) {
      expect(writeFile).toHaveBeenCalledWith(
        join(defaultFeatureDir, "user", `${name}-user-users-by-id.ts`),
        expect.any(String),
        "utf-8",
      );
    }

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultDir, "v1", "users", "[id].ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should wire the route with the correct handler → route relative import", async () => {
    await generateRoute(undefined, undefined, {
      feature: "user",
      methods: "get,post,put,delete",
      path: "/v1/users/[id]",
    });

    const routeCall = writeFile.mock.calls.find(
      (c) => c[0] === join(defaultDir, "v1", "users", "[id].ts"),
    );
    const content = routeCall![1] as string;

    expect(content).toContain(
      'import type { ServerHttpMiddleware } from "../../../types/context.js";',
    );
    expect(content).toContain(
      'import { getUserUsersById, getUserUsersByIdSchema } from "../../../features/user/get-user-users-by-id.js";',
    );
    expect(content).toContain("export const DELETE: Array<ServerHttpMiddleware>");
  });

  it("should honour a lindorm.config featureDir", async () => {
    loadLindormConfig.mockResolvedValueOnce({
      pylon: { featureDir: "./from/config/features" },
    });

    await generateRoute(undefined, undefined, {
      feature: "user",
      methods: "get",
      path: "/v1/users/[id]",
    });

    const configFeatureDir = resolve(process.cwd(), "./from/config/features");

    expect(writeFile).toHaveBeenCalledWith(
      join(configFeatureDir, "user", "get-user-users-by-id.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should let the positional method arg feed feature mode when the flag is absent", async () => {
    await generateRoute("get", "/v1/users/[id]", { feature: "user" });

    expect(writeFile).toHaveBeenCalledWith(
      join(defaultFeatureDir, "user", "get-user-users-by-id.ts"),
      expect.any(String),
      "utf-8",
    );
  });

  it("should not write files in feature dry-run mode", async () => {
    await generateRoute(undefined, undefined, {
      feature: "user",
      methods: "get,post,put,delete",
      path: "/v1/users/[id]",
      dryRun: true,
    });

    expect(writeFile).not.toHaveBeenCalled();
  });

  it("should throw on an unsupported method in feature mode", async () => {
    await expect(
      generateRoute(undefined, undefined, {
        feature: "user",
        methods: "options",
        path: "/v1/users/[id]",
      }),
    ).rejects.toThrow('Unsupported HTTP method "OPTIONS"');
  });
});
