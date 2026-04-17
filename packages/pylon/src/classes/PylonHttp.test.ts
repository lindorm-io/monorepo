import { createMockAmphora } from "@lindorm/amphora/mocks";
import { createMockIrisSource } from "@lindorm/iris/mocks";
import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import request from "supertest";
import { PylonHttp } from "./PylonHttp";

const createPylonHttp = (overrides: Record<string, unknown> = {}): PylonHttp => {
  const pylonHttp = new PylonHttp({
    amphora: createMockAmphora() as any,
    logger: createMockLogger(),
    ...overrides,
  });

  pylonHttp.loadMiddleware();
  pylonHttp.loadRouters();

  return pylonHttp;
};

describe("PylonHttp health endpoint", () => {
  test("should respond 204 when no proteus, iris, or callback is configured", async () => {
    const pylonHttp = createPylonHttp();

    await request(pylonHttp.callback).get("/health").expect(204);
  });

  test("should prefer the user-provided callback over auto-built one", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();
    const health = jest.fn();

    const pylonHttp = createPylonHttp({
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

    const pylonHttp = createPylonHttp({
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

    const pylonHttp = createPylonHttp({ proteus });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
  });

  test("should auto-ping iris when provided without a callback", async () => {
    const iris = createMockIrisSource();

    const pylonHttp = createPylonHttp({ iris });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should auto-ping both proteus and iris when both are provided", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();

    const pylonHttp = createPylonHttp({ proteus, iris });

    await request(pylonHttp.callback).get("/health").expect(204);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should return 503 when proteus ping returns false", async () => {
    const proteus = createMockProteusSource();
    proteus.ping.mockResolvedValueOnce(false);

    const pylonHttp = createPylonHttp({ proteus });

    const response = await request(pylonHttp.callback).get("/health").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["proteus"] },
    });
  });

  test("should return 503 when iris ping rejects", async () => {
    const iris = createMockIrisSource();
    iris.ping.mockRejectedValueOnce(new Error("broker down"));

    const pylonHttp = createPylonHttp({ iris });

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

    const pylonHttp = createPylonHttp({ proteus, iris });

    const response = await request(pylonHttp.callback).get("/health").expect(503);

    expect(response.body.error).toMatchObject({
      code: "health_check_failed",
      data: { failures: ["proteus", "iris"] },
    });
  });
});
