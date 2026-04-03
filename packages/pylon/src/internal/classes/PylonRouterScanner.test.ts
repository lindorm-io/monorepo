import { createMockLogger } from "@lindorm/logger";
import { join } from "path";
import { PylonRouter } from "../../classes/PylonRouter";
import { PylonRouterScanner } from "./PylonRouterScanner";
import { rootMiddleware } from "../../__fixtures__/routes/_middleware";

describe("PylonRouterScanner", () => {
  const logger = createMockLogger();
  const directory = join(__dirname, "..", "..", "__fixtures__", "routes");
  const scanner = new PylonRouterScanner(logger);

  test("should return a PylonRouter", () => {
    const router = scanner.scan(directory);

    expect(router).toBeInstanceOf(PylonRouter);
  });

  test("should register file-as-handler routes", () => {
    const router = scanner.scan(directory);
    const routes = router.stack.map((r: any) => ({
      methods: r.methods,
      path: r.path,
    }));

    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: "/health",
          methods: expect.arrayContaining(["GET"]),
        }),
        expect.objectContaining({
          path: "/v1/users",
          methods: expect.arrayContaining(["GET"]),
        }),
        expect.objectContaining({
          path: "/v1/users",
          methods: expect.arrayContaining(["POST"]),
        }),
        expect.objectContaining({
          path: "/v1/users/:id",
          methods: expect.arrayContaining(["GET"]),
        }),
        expect.objectContaining({
          path: "/v1/users/:id",
          methods: expect.arrayContaining(["PUT"]),
        }),
        expect.objectContaining({
          path: "/v1/users/:id",
          methods: expect.arrayContaining(["DELETE"]),
        }),
      ]),
    );
  });

  test("should strip route groups from path", () => {
    const router = scanner.scan(directory);
    const paths = router.stack.map((r: any) => r.path);

    // (admin) group stripped — dashboard is at /v1/dashboard not /v1/admin/dashboard
    expect(paths).toContain("/v1/dashboard");
    expect(paths).not.toContain("/v1/admin/dashboard");
    expect(paths).not.toContain("/v1/(admin)/dashboard");
  });

  test("should handle catch-all routes", () => {
    const router = scanner.scan(directory);
    const paths = router.stack.map((r: any) => r.path);

    expect(paths).toEqual(expect.arrayContaining([expect.stringContaining("/proxy/")]));
  });

  test("should handle PylonRouter instance exports", () => {
    const router = scanner.scan(directory);
    const paths = router.stack.map((r: any) => r.path);

    expect(paths).toContain("/custom");
  });

  test("should inherit middleware from _middleware.ts files", () => {
    const router = scanner.scan(directory);

    // Find the health route — should have rootMiddleware in its stack
    const healthRoute = router.stack.find(
      (r: any) => r.path === "/health" && r.methods.includes("GET"),
    );

    expect(healthRoute).toBeDefined();
    expect(healthRoute!.stack).toEqual(expect.arrayContaining([rootMiddleware]));
  });
});
