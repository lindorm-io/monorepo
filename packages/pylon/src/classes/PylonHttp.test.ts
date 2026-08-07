import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { join } from "path";
import request from "supertest";
import { PylonHttp } from "./PylonHttp.js";
import { PylonRouter } from "./PylonRouter.js";
import { describe, expect, test, vi } from "vitest";

const createPylonHttp = async (
  overrides: Record<string, unknown> = {},
): Promise<PylonHttp> => {
  const pylonHttp = new PylonHttp({
    amphora: createMockAmphora() as any,
    logger: createMockLogger(),
    ...overrides,
  });

  pylonHttp.loadMiddleware();
  await pylonHttp.loadRouters();

  return pylonHttp;
};

describe("PylonHttp /health (liveness)", () => {
  test("responds 204 when no proteus, iris, or callback is configured", async () => {
    const pylonHttp = await createPylonHttp();

    await request(pylonHttp.callback).get("/health").expect(204);
  });

  test("prefers a user-provided health callback over the auto-built one", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();
    const health = vi.fn();

    const pylonHttp = await createPylonHttp({ db: proteus, iris, callbacks: { health } });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(health).toHaveBeenCalledTimes(1);
    expect(proteus.ping).not.toHaveBeenCalled();
    expect(iris.ping).not.toHaveBeenCalled();
  });

  test("skips the auto-check when callbacks.health is explicitly null", async () => {
    const proteus = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ db: proteus, callbacks: { health: null } });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).not.toHaveBeenCalled();
  });

  test("checks I/O once then latches — no re-ping on subsequent calls", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();

    const pylonHttp = await createPylonHttp({ db: proteus, bus: iris });

    await request(pylonHttp.callback).get("/health").expect(204);
    await request(pylonHttp.callback).get("/health").expect(204);
    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  // Liveness stays on the DURABLE I/O only — readiness already drains a pod
  // whose ephemeral store is unreachable, and a restart cannot fix either one.
  test("does not ping the ephemeral sources", async () => {
    const cache = await createMockProteusSource();
    const db = await createMockProteusSource();
    const kv = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ cache, db, kv });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(db.ping).toHaveBeenCalledTimes(1);
    expect(kv.ping).not.toHaveBeenCalled();
    expect(cache.ping).not.toHaveBeenCalled();
  });

  test("stays 503 until the first successful check, then latches healthy", async () => {
    const proteus = await createMockProteusSource();
    proteus.ping.mockResolvedValueOnce(false);

    const pylonHttp = await createPylonHttp({ db: proteus });

    // Not latched yet: the failing check surfaces as 503.
    const failed = await request(pylonHttp.callback).get("/health").expect(503);
    expect(failed.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["db"] },
    });

    // Recovers → latches healthy → never pings again.
    await request(pylonHttp.callback).get("/health").expect(204);
    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(2);
  });
});

describe("PylonHttp /ready (readiness)", () => {
  test("responds 204 when no proteus or iris is configured", async () => {
    const pylonHttp = await createPylonHttp();

    await request(pylonHttp.callback).get("/ready").expect(204);
  });

  test("pings proteus + iris on every call (reflects live state)", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();

    const pylonHttp = await createPylonHttp({ db: proteus, bus: iris });

    await request(pylonHttp.callback).get("/ready").expect(204);
    await request(pylonHttp.callback).get("/ready").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(2);
    expect(iris.ping).toHaveBeenCalledTimes(2);
  });

  test("returns 503 when proteus ping returns false", async () => {
    const proteus = await createMockProteusSource();
    proteus.ping.mockResolvedValue(false);

    const pylonHttp = await createPylonHttp({ db: proteus });

    const response = await request(pylonHttp.callback).get("/ready").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["db"] },
    });
  });

  test("returns 503 when iris ping rejects", async () => {
    const iris = await createMockIrisSource();
    iris.ping.mockRejectedValue(new Error("broker down"));

    const pylonHttp = await createPylonHttp({ bus: iris });

    const response = await request(pylonHttp.callback).get("/ready").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["bus"] },
    });
  });

  // `kv` and `cache` can be separately deployed instances. Without them in the
  // probe, a pod whose session store is unreachable reports ready and every
  // login on it fails.
  test("returns 503 when the kv source is down", async () => {
    const db = await createMockProteusSource();
    const kv = await createMockProteusSource();
    kv.ping.mockResolvedValue(false);

    const pylonHttp = await createPylonHttp({ db, kv });

    const response = await request(pylonHttp.callback).get("/ready").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["kv"] },
    });
    expect(db.ping).toHaveBeenCalledTimes(1);
  });

  test("returns 503 when a separately configured cache source is down", async () => {
    const kv = await createMockProteusSource();
    const cache = await createMockProteusSource();
    cache.ping.mockRejectedValue(new Error("cache down"));

    const pylonHttp = await createPylonHttp({ kv, cache });

    const response = await request(pylonHttp.callback).get("/ready").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["cache"] },
    });
    expect(kv.ping).toHaveBeenCalledTimes(1);
  });

  test("pings every configured role", async () => {
    const bus = await createMockIrisSource();
    const cache = await createMockProteusSource();
    const db = await createMockProteusSource();
    const kv = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ bus, cache, db, kv });

    await request(pylonHttp.callback).get("/ready").expect(204);

    for (const source of [bus, cache, db, kv]) {
      expect(source.ping).toHaveBeenCalledTimes(1);
    }
  });

  test("does not double-ping when cache is unset and falls back to kv", async () => {
    const kv = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ kv });

    await request(pylonHttp.callback).get("/ready").expect(204);

    expect(kv.ping).toHaveBeenCalledTimes(1);
  });

  test("responds 204 when only some roles are configured", async () => {
    const kv = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ kv });

    await request(pylonHttp.callback).get("/ready").expect(204);
  });

  test("prefers a user-provided ready callback", async () => {
    const proteus = await createMockProteusSource();
    const ready = vi.fn();

    const pylonHttp = await createPylonHttp({ db: proteus, callbacks: { ready } });

    await request(pylonHttp.callback).get("/ready").expect(204);

    expect(ready).toHaveBeenCalledTimes(1);
    expect(proteus.ping).not.toHaveBeenCalled();
  });

  test("skips the check when callbacks.ready is explicitly null", async () => {
    const proteus = await createMockProteusSource();

    const pylonHttp = await createPylonHttp({ db: proteus, callbacks: { ready: null } });

    await request(pylonHttp.callback).get("/ready").expect(204);

    expect(proteus.ping).not.toHaveBeenCalled();
  });
});

describe("PylonHttp routes option", () => {
  const routesDir = join(__dirname, "..", "__fixtures__", "routes");

  const buildRouter = (marker: string): PylonRouter => {
    const router = new PylonRouter();
    router.get("/probe", async (ctx) => {
      ctx.status = 200;
      ctx.body = { marker };
    });
    return router;
  };

  test("should accept a bare directory path string and scan it", async () => {
    const pylonHttp = await createPylonHttp({ routes: routesDir });

    const response = await request(pylonHttp.callback).get("/custom").expect(200);
    expect(response.body.route).toBe("custom");
  });

  test("should accept a bare PylonHttpRouters entry and mount it", async () => {
    const pylonHttp = await createPylonHttp({
      routes: { path: "/solo", router: buildRouter("solo") },
    });

    const response = await request(pylonHttp.callback).get("/solo/probe").expect(200);
    expect(response.body).toEqual({ marker: "solo" });
  });

  test("should accept an array of pre-built PylonHttpRouters", async () => {
    const pylonHttp = await createPylonHttp({
      routes: [
        { path: "/alpha", router: buildRouter("alpha") },
        { path: "/beta", router: buildRouter("beta") },
      ],
    });

    const alpha = await request(pylonHttp.callback).get("/alpha/probe").expect(200);
    const beta = await request(pylonHttp.callback).get("/beta/probe").expect(200);

    expect(alpha.body).toEqual({ marker: "alpha" });
    expect(beta.body).toEqual({ marker: "beta" });
  });

  test("should accept an array of directory path strings and scan each", async () => {
    const pylonHttp = await createPylonHttp({ routes: [routesDir] });

    const response = await request(pylonHttp.callback).get("/custom").expect(200);
    expect(response.body.route).toBe("custom");
  });

  test("should accept a mixed array of scanner paths and pre-built routers", async () => {
    const pylonHttp = await createPylonHttp({
      routes: [routesDir, { path: "/mixed", router: buildRouter("mixed") }],
    });

    const scanned = await request(pylonHttp.callback).get("/custom").expect(200);
    const direct = await request(pylonHttp.callback).get("/mixed/probe").expect(200);

    expect(scanned.body.route).toBe("custom");
    expect(direct.body).toEqual({ marker: "mixed" });
  });
});
