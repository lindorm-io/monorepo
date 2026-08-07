// `useCache` and `useRateLimit` both store in `ctx.cache` — the ordinary
// evictable session — so what they can do is decided by ONE thing: whether an
// evictable source (`cache`, or the `kv` fallback) was configured.
//
// ⚠ MOUNTING is the declaration that a feature is on, for BOTH of them. There is
// no `responseCache` settings block at all — every knob `useCache` reads is
// stated per mount — and pylon never injects a `useRateLimit()` of its own into a
// deployment's chain: a global limiter is an explicit mount in the routes' root
// `_middleware.ts`. The `rateLimit` block is POLICY (window, ceiling, strategy,
// key, skip) that a mount inherits, and NOT a switch: a mount stating its own
// limits works with no block at all, and one stating none throws rather than
// standing in the chain allowing everything. Asserted end to end through a real
// PylonHttp with a real router.

import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { join } from "path";
import { createLoopbackRequest } from "../__fixtures__/loopback-request.js";
import { afterAll, beforeAll, beforeEach, describe, expect, test } from "vitest";
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

  // No `useRateLimit` anywhere on this route — so anything that limits it came
  // from the framework, which is exactly what must not happen.
  router.get("/plain", async (ctx) => {
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  // A bare mount: every limit is inherited from the deployment, so this route is
  // bounded only when a `rateLimit` block bounds it.
  router.get("/limited", useRateLimit(), async (ctx) => {
    ctx.status = 200;
    ctx.body = { ok: true };
  });

  // A mount that states BOTH its limits and so needs nothing from the deployment.
  router.get(
    "/self-limited",
    useRateLimit({ window: "1 minute", max: 1 }),
    async (ctx) => {
      ctx.status = 200;
      ctx.body = { ok: true };
    },
  );

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

// ONE loopback-bound server for the file, dialled on the address it is bound to.
// supertest otherwise binds the wildcard and dials 127.0.0.1, which lets a
// foreign local listener answer instead — see __fixtures__/loopback-request.ts.
const loopback = createLoopbackRequest();

beforeAll(() => loopback.start());
afterAll(() => loopback.stop());

describe("PylonHttp response cache over ctx.cache", () => {
  let kv: Awaited<ReturnType<typeof createEvictableSource>>;

  beforeEach(async () => {
    kv = await createEvictableSource();
  });

  // ⚠ NOTHING is configured for the response cache — there is no settings block
  // to configure. The mount is the declaration; the deployment only supplies a
  // store. The `cache ?? kv` fallback means a single-store deployment gets one.
  test("should MISS then HIT with no response-cache configuration at all", async () => {
    const pylonHttp = await createPylonHttp({ kv });

    const first = await loopback
      .request(pylonHttp.callback)
      .get("/v1/cached")
      .expect(200);
    const second = await loopback
      .request(pylonHttp.callback)
      .get("/v1/cached")
      .expect(200);

    expect(first.headers["x-pylon-cache"]).toBe("MISS");
    expect(second.headers["x-pylon-cache"]).toBe("HIT");
    expect(second.body).toEqual(first.body);
  });

  // The split store: `cache` WINS over `kv`, and the entries land in it.
  test("should store in the cache source when the two are split", async () => {
    const cache = await createEvictableSource();

    const pylonHttp = await createPylonHttp({ cache, kv });

    await loopback.request(pylonHttp.callback).get("/v1/cached").expect(200);

    expect(await cache.repository(CachedResponse).find({})).toHaveLength(1);
    expect(await kv.repository(CachedResponse).find({})).toHaveLength(0);
  });

  // ⚠ The state a second switch used to produce. Nothing can emit it now: with
  // the deployment block gone there is no way to mount `useCache` on a route and
  // have the deployment quietly turn it off underneath.
  test("should never report the cache as DISABLED", async () => {
    const pylonHttp = await createPylonHttp({ kv });

    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/cached")
      .expect(200);

    expect(response.headers["x-pylon-cache"]).not.toBe("DISABLED");
  });

  // Mounted with nowhere to store is a MISCONFIGURATION, and says so.
  test("should fail the request when mounted with no evictable source", async () => {
    const pylonHttp = await createPylonHttp({});

    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/cached")
      .expect(500);

    expect(response.body.error.code).toBe("cache_not_configured");
  });
});

describe("PylonHttp rate limit over ctx.cache", () => {
  test("should count and deny over the kv fallback source", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      kv,
      rateLimit: { window: "1 minute", max: 1 },
    });

    const first = await loopback
      .request(pylonHttp.callback)
      .get("/v1/limited")
      .expect(200);
    await loopback.request(pylonHttp.callback).get("/v1/limited").expect(429);

    expect(first.headers["x-ratelimit-limit"]).toBe("1");
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(1);
  });

  // ⭐ NOTHING is configured for rate limiting — no `rateLimit` block at all —
  // and the mount still limits, on the numbers it states itself. The deployment
  // owes a limiter exactly what it owes the response cache: an evictable source.
  test("should limit a self-bounded mount with no rateLimit block at all", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({ kv });

    const first = await loopback
      .request(pylonHttp.callback)
      .get("/v1/self-limited")
      .expect(200);
    await loopback.request(pylonHttp.callback).get("/v1/self-limited").expect(429);

    expect(first.headers["x-ratelimit-limit"]).toBe("1");
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(1);
  });

  // ⭐ The regression this file now holds: a mounted limiter bounded by NOTHING
  // used to pass every request through in silence, because the middleware
  // short-circuited on the missing block before it could reach the bounds check.
  // A rate limiter that is not limiting must say so.
  test("should fail a bare mount when no rateLimit block bounds it", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({ kv });

    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/limited")
      .expect(500);

    expect(response.body.error.code).toBe("rate_limit_not_bounded");
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(0);
  });

  // Mounted, bounded, and nowhere to keep the counters — the limiter's half of
  // `cache_not_configured`, and the only thing it asks of the deployment.
  test("should fail a bounded mount with no evictable source", async () => {
    const pylonHttp = await createPylonHttp({});

    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/self-limited")
      .expect(500);

    expect(response.body.error.code).toBe("rate_limit_not_configured");
  });

  // ⭐ The rule this file exists to hold: a policy block is NOT a mount. Pylon
  // used to inject `useRateLimit()` into the chain whenever `window` and `max`
  // were set, which limited routes that never asked to be limited and left the
  // deployment no way to say where in the chain it happened.
  test("should NOT limit an unmounted route, however complete the policy", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      kv,
      rateLimit: { window: "1 minute", max: 1, strategy: "fixed" },
    });

    const first = await loopback.request(pylonHttp.callback).get("/v1/plain").expect(200);
    await loopback.request(pylonHttp.callback).get("/v1/plain").expect(200);
    await loopback.request(pylonHttp.callback).get("/v1/plain").expect(200);

    expect(first.headers["x-ratelimit-limit"]).toBeUndefined();
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(0);
  });

  // …and the replacement for it: the deployment mounts one itself, in the
  // routes' root `_middleware.ts`, which every scanned route inherits.
  test("should limit every scanned route when the root _middleware mounts one", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({
      kv,
      routes: join(__dirname, "..", "__fixtures__", "rate-limit-routes"),
      rateLimit: { window: "1 minute", max: 1 },
    });

    const first = await loopback.request(pylonHttp.callback).get("/limited").expect(200);
    await loopback.request(pylonHttp.callback).get("/limited").expect(429);

    expect(first.headers["x-ratelimit-limit"]).toBe("1");
    expect(await kv.repository(RateLimitFixed).find({})).toHaveLength(1);
  });

  // A mount that inherits nothing and states nothing is a misconfiguration, and
  // says so rather than silently allowing every request.
  test("should throw rate_limit_not_bounded for a bare policy and a bare mount", async () => {
    const kv = await createEvictableSource();

    const pylonHttp = await createPylonHttp({ kv, rateLimit: {} });

    const response = await loopback
      .request(pylonHttp.callback)
      .get("/v1/limited")
      .expect(500);

    expect(response.body.error.code).toBe("rate_limit_not_bounded");
  });
});
