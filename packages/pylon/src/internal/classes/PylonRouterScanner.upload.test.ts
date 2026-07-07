import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { join } from "path";
import { PylonRouterScanner } from "./PylonRouterScanner.js";
import { describe, expect, test } from "vitest";

describe("PylonRouterScanner UPLOAD", () => {
  const logger = createMockLogger();
  const directory = join(__dirname, "..", "..", "__fixtures__", "upload-routes");
  const scanner = new PylonRouterScanner(logger);

  // Each method is its own koa-router layer (`.post()`/`.put()` do not bundle
  // like `.get()` bundles HEAD), so a mount surfaces one POST layer and one PUT
  // layer for the same wildcard path.
  const methodsForPath = (
    routes: Array<{ path: string; methods: Array<string> }>,
    fragment: string,
  ): Array<string> =>
    routes.filter((r) => r.path.includes(fragment)).flatMap((r) => r.methods);

  test("registers an UPLOAD export as a POST + PUT wildcard subtree", async () => {
    const router = await scanner.scan(directory);
    const routes = router.stack.map((r: any) => ({ path: r.path, methods: r.methods }));

    // Single UPLOAD export (assets.ts) → wildcard mount under /assets.
    expect(routes).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ path: expect.stringContaining("/assets{/*path}") }),
      ]),
    );
    expect(methodsForPath(routes, "/assets")).toEqual(
      expect.arrayContaining(["POST", "PUT"]),
    );

    // Array-form UPLOAD export (protected.ts) is registered the same way.
    expect(methodsForPath(routes, "/protected")).toEqual(
      expect.arrayContaining(["POST", "PUT"]),
    );
  });
});
