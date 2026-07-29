import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { describe, expect, test } from "vitest";
import {
  buildLivenessCallback,
  buildReadinessCallback,
} from "./build-health-callbacks.js";

describe("buildReadinessCallback", () => {
  test("returns undefined when there is no I/O to check", () => {
    expect(buildReadinessCallback({})).toBeUndefined();
  });

  test("pings proteus + iris on every call", async () => {
    const proteus = await createMockProteusSource();
    const iris = createMockIrisSource();

    const callback = buildReadinessCallback({ db: proteus, bus: iris })!;

    await callback({} as any);
    await callback({} as any);

    expect(proteus.ping).toHaveBeenCalledTimes(2);
    expect(iris.ping).toHaveBeenCalledTimes(2);
  });

  test("throws a 503 health_check_failed when a source ping returns false", async () => {
    const proteus = await createMockProteusSource();
    proteus.ping.mockResolvedValue(false);

    const callback = buildReadinessCallback({ db: proteus })!;

    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
      data: { failures: ["db"] },
    });
  });

  test("throws when a source ping rejects", async () => {
    const iris = createMockIrisSource();
    iris.ping.mockRejectedValue(new Error("broker down"));

    const callback = buildReadinessCallback({ bus: iris })!;

    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
      data: { failures: ["bus"] },
    });
  });
});

describe("buildLivenessCallback", () => {
  test("returns undefined when there is no I/O to check", () => {
    expect(buildLivenessCallback({})).toBeUndefined();
  });

  test("checks I/O once, then latches success and stops pinging", async () => {
    const proteus = await createMockProteusSource();
    const iris = createMockIrisSource();

    const callback = buildLivenessCallback({ db: proteus, bus: iris })!;

    await callback({} as any);
    await callback({} as any);
    await callback({} as any);

    expect(proteus.ping).toHaveBeenCalledTimes(1);
    expect(iris.ping).toHaveBeenCalledTimes(1);
  });

  test("keeps checking until the first success, then latches", async () => {
    const proteus = await createMockProteusSource();
    proteus.ping.mockResolvedValueOnce(false);

    const callback = buildLivenessCallback({ db: proteus })!;

    // First check fails — not latched yet.
    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
    });

    // Recovers → latches → no further pings.
    await callback({} as any);
    await callback({} as any);

    expect(proteus.ping).toHaveBeenCalledTimes(2);
  });
});
