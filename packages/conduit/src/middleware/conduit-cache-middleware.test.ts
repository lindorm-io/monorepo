import MockDate from "mockdate";
import { ConduitMiddleware } from "../types";
import { createConduitCacheMiddleware } from "./conduit-cache-middleware";

const MockedDate = new Date("2024-01-01T08:00:00.000Z");
MockDate.set(MockedDate);

describe("conduitCacheMiddleware", () => {
  let ctx: any;
  let next: jest.Mock;
  let middleware: ConduitMiddleware;

  beforeEach(() => {
    ctx = {
      req: {
        url: "https://api.test/resource",
        config: {
          method: "GET",
        },
      },
      res: {
        data: { result: "data" },
        status: 200,
        statusText: "OK",
        headers: {},
      },
    };

    next = jest.fn().mockResolvedValue(undefined);
  });

  afterEach(() => {
    jest.clearAllMocks();
    MockDate.set(MockedDate);
  });

  test("caches GET responses and returns cached data on second call", async () => {
    middleware = createConduitCacheMiddleware({ maxAge: 10000 });

    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.res.data).toEqual({ result: "data" });

    // Change the response for second call
    ctx.res = {
      data: { result: "new data" },
      status: 200,
      statusText: "OK",
      headers: {},
    };

    await middleware(ctx, next);

    // Should still have cached data, next not called again
    expect(next).toHaveBeenCalledTimes(1);
    expect(ctx.res.data).toEqual({ result: "data" });
  });

  test("does not cache non-GET requests", async () => {
    middleware = createConduitCacheMiddleware();

    ctx.req.config.method = "POST";

    await middleware(ctx, next);
    await middleware(ctx, next);

    expect(next).toHaveBeenCalledTimes(2);
  });

  test("respects Cache-Control: no-store", async () => {
    middleware = createConduitCacheMiddleware();

    ctx.res.headers = { "cache-control": "no-store" };

    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    await middleware(ctx, next);

    // Should call next again (not cached)
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("respects Cache-Control: no-cache", async () => {
    middleware = createConduitCacheMiddleware();

    ctx.res.headers = { "cache-control": "no-cache, must-revalidate" };

    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    await middleware(ctx, next);

    // Should call next again (not cached)
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("expires cache after maxAge", async () => {
    middleware = createConduitCacheMiddleware({ maxAge: 5000 });

    await middleware(ctx, next);
    expect(next).toHaveBeenCalledTimes(1);

    // Advance time beyond maxAge
    MockDate.set(new Date(MockedDate.getTime() + 6000));

    await middleware(ctx, next);

    // Cache expired, should call next again
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("only caches successful responses (2xx)", async () => {
    middleware = createConduitCacheMiddleware();

    ctx.res.status = 404;

    await middleware(ctx, next);
    await middleware(ctx, next);

    // Should not cache non-2xx responses
    expect(next).toHaveBeenCalledTimes(2);
  });

  test("evicts oldest entry when maxEntries exceeded", async () => {
    middleware = createConduitCacheMiddleware({ maxEntries: 2 });

    const ctx1: any = {
      req: { url: "https://api.test/resource1", config: { method: "GET" } },
      res: { data: "data1", status: 200, statusText: "OK", headers: {} },
    };

    const ctx2: any = {
      req: { url: "https://api.test/resource2", config: { method: "GET" } },
      res: { data: "data2", status: 200, statusText: "OK", headers: {} },
    };

    const ctx3: any = {
      req: { url: "https://api.test/resource3", config: { method: "GET" } },
      res: { data: "data3", status: 200, statusText: "OK", headers: {} },
    };

    await middleware(ctx1, next);
    await middleware(ctx2, next);
    expect(next).toHaveBeenCalledTimes(2);

    // Third entry should evict first
    await middleware(ctx3, next);
    expect(next).toHaveBeenCalledTimes(3);

    // ctx1 should be evicted, will call next and get re-cached (evicts ctx2)
    await middleware(ctx1, next);
    expect(next).toHaveBeenCalledTimes(4);

    // ctx3 should still be cached
    await middleware(ctx3, next);
    expect(next).toHaveBeenCalledTimes(4);
  });

  test("handles numeric cache-control header values", async () => {
    middleware = createConduitCacheMiddleware();

    ctx.res.headers = { "cache-control": 123 as any };

    await middleware(ctx, next);
    await middleware(ctx, next);

    // Non-string cache-control should be treated as empty, allowing cache
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("uses default config values", async () => {
    middleware = createConduitCacheMiddleware();

    await middleware(ctx, next);
    await middleware(ctx, next);

    // Default maxAge is 300000ms (5 minutes)
    expect(next).toHaveBeenCalledTimes(1);
  });

  test("caches different URLs separately", async () => {
    middleware = createConduitCacheMiddleware();

    const ctx1: any = {
      req: { url: "https://api.test/resource1", config: { method: "GET" } },
      res: { data: "data1", status: 200, statusText: "OK", headers: {} },
    };

    const ctx2: any = {
      req: { url: "https://api.test/resource2", config: { method: "GET" } },
      res: { data: "data2", status: 200, statusText: "OK", headers: {} },
    };

    await middleware(ctx1, next);
    await middleware(ctx2, next);

    expect(next).toHaveBeenCalledTimes(2);

    // Both should be cached independently
    await middleware(ctx1, next);
    await middleware(ctx2, next);

    expect(next).toHaveBeenCalledTimes(2);
    expect(ctx1.res.data).toBe("data1");
    expect(ctx2.res.data).toBe("data2");
  });
});
