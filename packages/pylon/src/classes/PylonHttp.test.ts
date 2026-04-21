import { createMockAmphora } from "@lindorm/amphora/mocks/vitest";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { join } from "path";
import request from "supertest";
import { PylonHttp } from "./PylonHttp";
import { PylonRouter } from "./PylonRouter";
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

describe("PylonHttp health endpoint", () => {
  test("should respond 204 when no proteus, iris, or callback is configured", async () => {
    const pylonHttp = await createPylonHttp();

    await request(pylonHttp.callback).get("/health").expect(204);
  });

  test("should prefer the user-provided callback over auto-built one", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();
    const health = vi.fn();

    const pylonHttp = await createPylonHttp({
      proteus,
      iris,
      callbacks: { health },
    });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(health).toHaveBeenCalledTimes(1);
    expect(proteus.ping).not.toHaveBeenCalled();
    expect(iris.ping).not.toHaveBeenCalled();
  });

  test("should skip auto-check when callbacks.health is explicitly null", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();

    const pylonHttp = await createPylonHttp({
      proteus,
      iris,
      callbacks: { health: null },
    });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).not.toHaveBeenCalled();
    expect(iris.ping).not.toHaveBeenCalled();
  });

  test("should auto-ping proteus when provided without a callback", async () => {
    const proteus = createMockProteusSource();

    const pylonHttp = await createPylonHttp({ proteus });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
  });

  test("should auto-ping iris when provided without a callback", async () => {
    const iris = createMockIrisSource();

    const pylonHttp = await createPylonHttp({ iris });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should auto-ping both proteus and iris when both are provided", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();

    const pylonHttp = await createPylonHttp({ proteus, iris });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should return 503 when proteus ping returns false", async () => {
    const proteus = createMockProteusSource();
    proteus.ping.mockResolvedValueOnce(false);

    const pylonHttp = await createPylonHttp({ proteus });

    const response = await request(pylonHttp.callback).get("/health").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["proteus"] },
    });
  });

  test("should return 503 when iris ping rejects", async () => {
    const iris = createMockIrisSource();
    iris.ping.mockRejectedValueOnce(new Error("broker down"));

    const pylonHttp = await createPylonHttp({ iris });

    const response = await request(pylonHttp.callback).get("/health").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["iris"] },
    });
  });

  test("should return 503 listing both failures when proteus and iris are both down", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();
    proteus.ping.mockResolvedValueOnce(false);
    iris.ping.mockRejectedValueOnce(new Error("broker down"));

    const pylonHttp = await createPylonHttp({ proteus, iris });

    const response = await request(pylonHttp.callback).get("/health").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["proteus", "iris"] },
    });
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
