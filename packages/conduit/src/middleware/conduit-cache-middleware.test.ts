import { createMemoryCacheDriver } from "../drivers/index.js";
import type { ConduitResponse } from "../types/index.js";
import { createConduitCacheMiddleware } from "./conduit-cache-middleware.js";
import { describe, expect, test, vi } from "vitest";

const ok: ConduitResponse = {
  cached: null,
  data: { ok: true },
  status: 200,
  statusText: "OK",
  headers: {},
};

const makeCtx = (method = "GET", query: any = {}): any => ({
  req: {
    config: { method },
    url: "https://api.example.com/songs",
    query,
    body: undefined,
  },
  res: undefined,
});

describe("conduitCacheMiddleware", () => {
  test("caches a GET: miss then hit", async () => {
    const mw = createConduitCacheMiddleware();

    const a = makeCtx();
    await mw(a, async () => {
      a.res = { ...ok };
    });
    expect(a.res.headers["x-conduit-cache-middleware"]).toBe("MISS");

    const b = makeCtx();
    const next = vi.fn();
    await mw(b, next);

    expect(next).not.toHaveBeenCalled();
    expect(b.res.headers["x-conduit-cache-middleware"]).toBe("HIT");
    expect(typeof b.res.headers.age).toBe("number");
    expect(b.res.data).toEqual({ ok: true });
  });

  test("does not cache non-configured methods (POST bypasses by default)", async () => {
    const mw = createConduitCacheMiddleware();

    const ctx = makeCtx("POST");
    const next = vi.fn(async () => {
      ctx.res = { ...ok };
    });
    await mw(ctx, next);

    expect(next).toHaveBeenCalled();
    expect(ctx.res.headers?.["x-conduit-cache-middleware"]).toBeUndefined();
  });

  test("caches configured methods", async () => {
    const mw = createConduitCacheMiddleware({ methods: ["GET", "POST"] });

    const a = makeCtx("POST");
    await mw(a, async () => {
      a.res = { ...ok };
    });

    const b = makeCtx("POST");
    const next = vi.fn();
    await mw(b, next);

    expect(next).not.toHaveBeenCalled();
    expect(b.res.headers["x-conduit-cache-middleware"]).toBe("HIT");
  });

  test("respects a response Cache-Control: no-store", async () => {
    const mw = createConduitCacheMiddleware();

    const a = makeCtx();
    await mw(a, async () => {
      a.res = { ...ok, headers: { "cache-control": "no-store" } };
    });

    const b = makeCtx();
    const next = vi.fn(async () => {
      b.res = { ...ok };
    });
    await mw(b, next);

    // Not served from cache — the no-store response was never stored.
    expect(next).toHaveBeenCalled();
  });

  test('field-scoped Cache-Control: no-cache="set-cookie" is still cached', async () => {
    const mw = createConduitCacheMiddleware();

    const a = makeCtx();
    await mw(a, async () => {
      a.res = { ...ok, headers: { "cache-control": 'no-cache="set-cookie"' } };
    });

    const b = makeCtx();
    const next = vi.fn(async () => {
      b.res = { ...ok };
    });
    await mw(b, next);

    // Served FROM cache — a field-scoped no-cache marks only the named header
    // uncacheable, not the body, so the response WAS stored (RFC 7234 §5.2.2.2).
    expect(next).not.toHaveBeenCalled();
  });

  test("offline: a miss throws instead of performing the request", async () => {
    const mw = createConduitCacheMiddleware({ offline: true });

    const ctx = makeCtx();
    const next = vi.fn();
    await expect(mw(ctx, next)).rejects.toThrow(/offline/i);
    expect(next).not.toHaveBeenCalled();
  });

  test("uses an injected driver", async () => {
    const driver = createMemoryCacheDriver();
    const setSpy = vi.spyOn(driver, "set");
    const mw = createConduitCacheMiddleware({ driver });

    const ctx = makeCtx();
    await mw(ctx, async () => {
      ctx.res = { ...ok };
    });

    expect(setSpy).toHaveBeenCalled();
  });

  test("single-flight: concurrent identical misses share one fetch", async () => {
    const mw = createConduitCacheMiddleware();

    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const a = makeCtx();
    const nextA = vi.fn(async () => {
      await gate;
      a.res = { ...ok };
    });

    const b = makeCtx();
    const nextB = vi.fn();

    const promiseA = mw(a, nextA);
    await new Promise((resolve) => setImmediate(resolve));
    const promiseB = mw(b, nextB);
    await new Promise((resolve) => setImmediate(resolve));

    release();
    await Promise.all([promiseA, promiseB]);

    expect(nextA).toHaveBeenCalledTimes(1);
    expect(nextB).not.toHaveBeenCalled();
    expect(b.res.data).toEqual({ ok: true });
    expect(b.res.headers["x-conduit-cache-middleware"]).toBe("MISS");
  });
});
