import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { join } from "path";
import {
  createServerFromRouter,
  rawRequest,
  type StaticTestServer,
} from "../../__fixtures__/static-helpers/http-server.js";
import { PylonError } from "../../errors/index.js";
import { PylonRouterScanner } from "./PylonRouterScanner.js";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

const logger = createMockLogger();

describe("PylonRouterScanner STATIC behaviour", () => {
  test("rejects a file exporting STATIC alongside an HTTP method", async () => {
    const scanner = new PylonRouterScanner(logger);
    const directory = join(
      __dirname,
      "..",
      "..",
      "__fixtures__",
      "static-routes-conflict",
    );

    let thrown: PylonError | undefined;
    try {
      await scanner.scan(directory);
    } catch (err) {
      thrown = err as PylonError;
    }

    expect(thrown).toBeInstanceOf(PylonError);
    expect(thrown?.code).toBe("conflicting_static_export");
  });

  describe("scanned mount pipeline", () => {
    let server: StaticTestServer;

    beforeAll(async () => {
      const scanner = new PylonRouterScanner(logger);
      const directory = join(__dirname, "..", "..", "__fixtures__", "static-routes");
      const router = await scanner.scan(directory);
      server = await createServerFromRouter(router);
    });

    afterAll(async () => {
      await server.close();
    });

    test("_middleware runs before the mount and the file is served", async () => {
      const res = await rawRequest(server.port, "/assets/sample.txt");

      expect(res.status).toBe(200);
      expect(res.headers["x-static-root-middleware"]).toBe("1");
      expect(res.body.toString()).toBe("0123456789".repeat(10));
    });

    test("array-form mount runs its own guard after the _middleware chain", async () => {
      const res = await rawRequest(server.port, "/protected/sample.txt");

      expect(res.status).toBe(200);
      expect(res.headers["x-static-root-middleware"]).toBe("1");
      expect(res.headers["x-static-guard"]).toBe("1");
      expect(res.headers["cache-control"]).toBe("private, max-age=0");
    });
  });
});
