import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { join } from "path";
import { PylonRouterScanner } from "./PylonRouterScanner.js";
import { describe, expect, test } from "vitest";

describe("PylonRouterScanner STATIC", () => {
  const logger = createMockLogger();
  const directory = join(__dirname, "..", "..", "__fixtures__", "static-routes");
  const scanner = new PylonRouterScanner(logger);

  test("registers a STATIC export as a GET + HEAD wildcard subtree", async () => {
    const router = await scanner.scan(directory);
    const routes = router.stack.map((r: any) => ({ path: r.path, methods: r.methods }));

    // Single STATIC export (assets.ts) → wildcard mount under /assets.
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("/assets"),
          methods: expect.arrayContaining(["GET", "HEAD"]),
        }),
      ]),
    );

    // Array-form STATIC export (protected.ts) is registered the same way.
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          path: expect.stringContaining("/protected"),
          methods: expect.arrayContaining(["GET", "HEAD"]),
        }),
      ]),
    );
  });
});
