import type { ConduitMiddleware } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import axios from "axios";
import nock from "nock";
import { afterEach, beforeEach, describe, expect, test, vi, type Mock } from "vitest";

axios.defaults.proxy = false;

import { createConduitMiddleware } from "./create-conduit-middleware.js";

/**
 * `@lindorm/conduit` is deliberately NOT mocked here: the sibling suite mocks
 * `Conduit` wholesale, which cannot see whether the configured host survives
 * into the constructed client. These tests run a REAL Conduit and assert the
 * request it actually makes.
 */
describe("createConduitMiddleware - base url", () => {
  let ctx: any;
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
    ctx = {
      logger: createMockLogger(),
      state: { metadata: { correlationId: "correlation-id", sessionId: "session-id" } },
      conduits: {},
    };
  });

  afterEach(() => {
    nock.cleanAll();
  });

  test("should request the configured host", async () => {
    const scope = nock("https://api.test.lindorm.io")
      .get("/users/me")
      .reply(200, { user_id: "user-id" });

    const middleware = createConduitMiddleware({
      alias: "myService",
      baseURL: "https://api.test.lindorm.io",
    });

    await middleware(ctx, next);

    const response = await ctx.conduits.myService.get("/users/me");

    expect(response.status).toBe(200);
    expect(response.data).toEqual({ userId: "user-id" });

    scope.done();
  });

  test("should resolve request paths against the configured base url", async () => {
    const middleware = createConduitMiddleware({
      alias: "myService",
      baseURL: "https://api.test.lindorm.io",
    });

    await middleware(ctx, next);

    let url: string | undefined;

    // Never calls next, so the chain stops before the http adapter runs.
    const capture: ConduitMiddleware = async (conduitCtx) => {
      url = conduitCtx.req.url;
    };

    await ctx.conduits.myService.get("/users/me", { middleware: [capture] });

    expect(url).toBe("https://api.test.lindorm.io/users/me");
  });

  test("should resolve each alias against its own base url", async () => {
    const middleware = createConduitMiddleware([
      { alias: "serviceA", baseURL: "https://a.test.lindorm.io" },
      { alias: "serviceB", baseURL: "https://b.test.lindorm.io" },
    ]);

    await middleware(ctx, next);

    const urls: Array<string> = [];

    const capture: ConduitMiddleware = async (conduitCtx) => {
      urls.push(conduitCtx.req.url);
    };

    await ctx.conduits.serviceA.get("/one", { middleware: [capture] });
    await ctx.conduits.serviceB.get("/two", { middleware: [capture] });

    expect(urls).toEqual([
      "https://a.test.lindorm.io/one",
      "https://b.test.lindorm.io/two",
    ]);
  });
});
