// `useCache` and `useRateLimit` both store in `ctx.cache` — the ordinary
// evictable session — so what they can do is decided by ONE thing: whether an
// evictable source (`cache`, or the `kv` fallback) was configured.
//
// ⚠ That is deliberately INDEPENDENT of `responseCache.enabled` /
// `rateLimit.enabled`, which only decide whether the feature RUNS
// (`ctx.state.app.config`). A route may mount `useCache` while the global
// feature is off; it passes through as DISABLED rather than throwing, and the
// session is there the moment the feature is switched on. Asserted end to end
// through a real PylonHttp with a real router.

import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import request from "supertest";
import { beforeEach, describe, expect, test } from "vitest";
import { CachedResponse } from "../entities/CachedResponse.js";
import { RateLimitFixed } from "../entities/RateLimitFixed.js";
import { useCache } from "../middleware/common/use-cache.js";
import { useRateLimit } from "../middleware/common/use-rate-limit.js";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";

const createEvictableSource = () =>
  createMockProteusSource({ entities: [CachedResponse, RateLimitFixed] });

const createRouter = (): PylonRouter => {
  const router = new PylonRouter();

  router.get("/cached", useCache("60 seconds", "public"), async (ctx) => {
    ctx.status = 200;
    ctx.body = { now: Date.now(), random: Math.random() };
  });

  return router;
};

const createPylonHttp = async (
  overrides: Record<string, unknown> = {},
): Promise<PylonHttp> => {
  const pylonHttp = new PylonHttp({
    amphora: createMockAmphora() as any,
    logger: createMockLogger(),
    routes: { path: "/v1", router: createRouter() },
    ...overrides,
  } as any);

  pylonHttp.loadMiddleware();
  await pylonHttp.loadRouters();

  return pylonHttp;
};

describe("PylonHttp response cache over ctx.cache", () => {
  let kv: Awaited<ReturnType<typeof createEvictableSource>>;

  beforeEach(async () => {
    kv = await createEvictableSource();
  });

  // The `cache ?? kv` fallback: a single-store deployment still gets a usable
  // `ctx.cache`, so `useCache` works with no `cache` source configured at all.
  test("should MISS then HIT when only a kv source is configured", async () => {
    const pylonHttp = await createPylonHttp({ kv, responseCache: { enabled: true } });

    const first = await request(pylonHttp.callback).get("/v1/cached").expect(200);
    const second = await request(pylonHttp.callback).get("/v1/cached").expect(200);

    expect(first.headers["x-pylon-cache"]).toBe("MISS");
    expect(second.headers["x-pylon-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body);
  });

  // The split store: `cache` WINS over `kv`, and the entries land in it.
  test("should store in the cache source when the two are split", async () => {
    const cache = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      cache,
      kv,
      responseCache: { enabled: true },
    });

    await request(pylonHttp.callback).get("/v1/cached").expect(200);

    expect(await cache.repository(CachedResponse).find({})).toHaveLength(1);
    expect(await kv.repository(CachedResponse).find({})).toHaveLength(0);
  });

  // ⚠ The gating that must not drift: the SESSION is installed whenever a source
  // is configured, regardless of `responseCache.enabled`. The feature switch only
  // short-circuits the middleware — it never throws, and never removes storage.
  test("should pass through as DISABLED, not throw, when the feature is off", async () => {
    const pylonHttp = await createPylonHttp({ kv, responseCache: { enabled: false } });

    const response = await request(pylonHttp.callback).get("/v1/cached").expect(200);

    expect(response.headers["x-pylon-cache"]).toBe("DISABLED");
    expect(await kv.repository(CachedResponse).find({})).toHaveLength(0);
  });

  // Enabled with nowhere to store is a MISCONFIGURATION, and says so.
  test("should fail the request when enabled with no evictable source", async () => {
    const pylonHttp = await createPylonHttp({ responseCache: { enabled: true } });

    const response = await request(pylonHttp.callback).get("/v1/cached").expect(500);

    expect(response.body.error.code).toBe("cache_not_configured");
  });
});

describe("PylonHttp rate limit over ctx.cache", () => {
  test("should count and deny over the kv fallback source", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      kv,
      rateLimit: { enabled: true, window: "1 minute", max: 1 },
    });

    const first = await request(pylonHttp.callback).get("/v1/cached").expect(200);
    await request(pylonHttp.callback).get("/v1/cached").expect(429);

    expect(first.headers["x-ratelimit-limit"]).toBe("1");
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(1);
  });

  test("should pass through silently when the feature is off", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      kv,
      rateLimit: { enabled: false, window: "1 minute", max: 1 },
    });

    await request(pylonHttp.callback).get("/v1/cached").expect(200);
    await request(pylonHttp.callback).get("/v1/cached").expect(200);

    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(0);
  });
});
