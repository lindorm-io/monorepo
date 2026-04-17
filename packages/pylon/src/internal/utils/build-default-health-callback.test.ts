import { ServerError } from "@lindorm/errors";
import { createMockIrisSource } from "@lindorm/iris/mocks";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { buildDefaultHealthCallback } from "./build-default-health-callback";

describe("buildDefaultHealthCallback", () => {
  test("should return undefined when neither proteus nor iris is provided", () => {
    expect(buildDefaultHealthCallback({})).toBeUndefined();
  });

  test("should build a callback that pings proteus only", async () => {
    const proteus = createMockProteusSource();

    const callback = buildDefaultHealthCallback({ proteus: proteus as any });
    await expect(callback!({} as any)).resolves.toBeUndefined();

    expect(proteus.ping).toHaveBeenCalledTimes(1);
  });

  test("should build a callback that pings iris only", async () => {
    const iris = createMockIrisSource();

    const callback = buildDefaultHealthCallback({ iris });
    await expect(callback!({} as any)).resolves.toBeUndefined();

    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should build a callback that pings both proteus and iris", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();

    const callback = buildDefaultHealthCallback({ proteus: proteus as any, iris });
    await expect(callback!({} as any)).resolves.toBeUndefined();

    expect(proteus.ping).toHaveBeenCalledTimes(1);
    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("should throw ServiceUnavailable when proteus ping returns false", async () => {
    const proteus = createMockProteusSource();
    proteus.ping.mockResolvedValueOnce(false);

    const callback = buildDefaultHealthCallback({ proteus: proteus as any });

    await expect(callback!({} as any)).rejects.toMatchObject({
      status: ServerError.Status.ServiceUnavailable,
      code: "health_check_failed",
      data: { failures: ["proteus"] },
    });
  });

  test("should throw ServiceUnavailable when proteus ping throws", async () => {
    const proteus = createMockProteusSource();
    proteus.ping.mockRejectedValueOnce(new Error("connection refused"));

    const callback = buildDefaultHealthCallback({ proteus: proteus as any });

    await expect(callback!({} as any)).rejects.toMatchObject({
      status: ServerError.Status.ServiceUnavailable,
      code: "health_check_failed",
      data: { failures: ["proteus"] },
    });
  });

  test("should throw ServiceUnavailable when iris ping returns false", async () => {
    const iris = createMockIrisSource();
    iris.ping.mockResolvedValueOnce(false);

    const callback = buildDefaultHealthCallback({ iris });

    await expect(callback!({} as any)).rejects.toMatchObject({
      status: ServerError.Status.ServiceUnavailable,
      code: "health_check_failed",
      data: { failures: ["iris"] },
    });
  });

  test("should throw ServiceUnavailable when iris ping throws", async () => {
    const iris = createMockIrisSource();
    iris.ping.mockRejectedValueOnce(new Error("broker down"));

    const callback = buildDefaultHealthCallback({ iris });

    await expect(callback!({} as any)).rejects.toMatchObject({
      status: ServerError.Status.ServiceUnavailable,
      code: "health_check_failed",
      data: { failures: ["iris"] },
    });
  });

  test("should report both failures when proteus and iris both fail", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();
    proteus.ping.mockResolvedValueOnce(false);
    iris.ping.mockRejectedValueOnce(new Error("broker down"));

    const callback = buildDefaultHealthCallback({ proteus: proteus as any, iris });

    await expect(callback!({} as any)).rejects.toMatchObject({
      status: ServerError.Status.ServiceUnavailable,
      code: "health_check_failed",
      data: { failures: ["proteus", "iris"] },
    });
  });
});
