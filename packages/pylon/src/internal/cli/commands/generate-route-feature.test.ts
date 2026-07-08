import { mkdir as _mkdir, writeFile as _writeFile } from "fs/promises";
import { Logger as _Logger } from "@lindorm/logger";
import { join, resolve } from "path";
import { generateRouteFeature } from "./generate-route-feature.js";
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

const routesDir = resolve(process.cwd(), "./src/routes");
const featureDir = resolve(process.cwd(), "./src/features");

const written = (filepath: string): string => {
  const call = writeFile.mock.calls.find((c) => c[0] === filepath);
  if (!call) throw new Error(`writeFile was not called with ${filepath}`);
  return call[1] as string;
};

describe("generateRouteFeature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("should write one handler file per method in the feature dir", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET", "POST", "PUT", "DELETE"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    for (const name of ["get", "create", "update", "delete"]) {
      expect(writeFile).toHaveBeenCalledWith(
        join(featureDir, "user", `${name}-user.ts`),
        expect.any(String),
        "utf-8",
      );
    }
  });

  it("should name handler/schema exports without a Handler suffix", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    const content = written(join(featureDir, "user", "get-user.ts"));

    expect(content).toContain("export const getUserSchema = z.object(");
    expect(content).toContain(
      "export const getUser: ServerHandler<typeof getUserSchema>",
    );
  });

  it("should compute the handler → context import as ../../types/context.js", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    const content = written(join(featureDir, "user", "get-user.ts"));

    expect(content).toContain(
      'import type { ServerHandler } from "../../types/context.js";',
    );
  });

  it("should write a route file wiring useSchema/useHandler per method", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET", "POST", "PUT", "DELETE"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    const content = written(join(routesDir, "v1", "users", "[id].ts"));

    for (const method of ["GET", "POST", "PUT", "DELETE"]) {
      expect(content).toContain(
        `export const ${method}: Array<ServerHttpMiddleware> = [`,
      );
    }

    expect(content).toContain("useSchema(getUserSchema)");
    expect(content).toContain("useHandler(getUser)");
  });

  it("should compute route → context and route → handler imports", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    const content = written(join(routesDir, "v1", "users", "[id].ts"));

    expect(content).toContain(
      'import type { ServerHttpMiddleware } from "../../../types/context.js";',
    );
    expect(content).toContain(
      'import { getUser, getUserSchema } from "../../../features/user/get-user.js";',
    );
  });

  it("should emit route exports in canonical HTTP order regardless of input order", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["DELETE", "GET", "PUT", "POST"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    const content = written(join(routesDir, "v1", "users", "[id].ts"));
    const order = ["GET", "POST", "PUT", "DELETE"].map((m) =>
      content.indexOf(`export const ${m}:`),
    );

    expect(order).toEqual([...order].sort((a, b) => a - b));
  });

  it("should snapshot the generated handler file", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    expect(written(join(featureDir, "user", "get-user.ts"))).toMatchSnapshot();
  });

  it("should snapshot the generated route file", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET", "POST", "PUT", "DELETE"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    expect(written(join(routesDir, "v1", "users", "[id].ts"))).toMatchSnapshot();
  });

  it("should honour a custom featureDir", async () => {
    const customFeatureDir = resolve(process.cwd(), "./src/slices");

    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir: customFeatureDir,
    });

    expect(writeFile).toHaveBeenCalledWith(
      join(customFeatureDir, "user", "get-user.ts"),
      expect.any(String),
      "utf-8",
    );

    // context still resolves relative to the custom feature dir's parent.
    const content = written(join(customFeatureDir, "user", "get-user.ts"));
    expect(content).toContain(
      'import type { ServerHandler } from "../../types/context.js";',
    );
  });

  it("should create parent directories recursively", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    expect(mkdir).toHaveBeenCalledWith(join(featureDir, "user"), {
      recursive: true,
    });
    expect(mkdir).toHaveBeenCalledWith(join(routesDir, "v1", "users"), {
      recursive: true,
    });
  });

  it("should not write files in dry-run mode", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET", "POST", "PUT", "DELETE"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
      dryRun: true,
    });

    expect(writeFile).not.toHaveBeenCalled();
    expect(mkdir).not.toHaveBeenCalled();
    expect(Logger.std.log).toHaveBeenCalledWith(expect.stringContaining("Dry run"));
  });

  it("should log a summary after writing", async () => {
    await generateRouteFeature({
      feature: "user",
      methodList: ["GET"],
      path: "/v1/users/[id]",
      routesDir,
      featureDir,
    });

    expect(Logger.std.info).toHaveBeenCalledWith(
      expect.stringContaining("Created feature route"),
    );
  });

  it("should throw on an unsupported HTTP method", async () => {
    await expect(
      generateRouteFeature({
        feature: "user",
        methodList: ["OPTIONS"],
        path: "/v1/users/[id]",
        routesDir,
        featureDir,
      }),
    ).rejects.toThrow('Unsupported HTTP method "OPTIONS"');
  });
});
