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
    const iris = await createMockIrisSource();

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
    const iris = await createMockIrisSource();
    iris.ping.mockRejectedValue(new Error("broker down"));

    const callback = buildReadinessCallback({ bus: iris })!;

    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
      data: { failures: ["bus"] },
    });
  });

  // `kv` and `cache` can be separately deployed instances. A pod whose session
  // store is unreachable must not report ready — every login on it fails.
  test("fails when the kv source is down", async () => {
    const db = await createMockProteusSource();
    const kv = await createMockProteusSource();
    kv.ping.mockResolvedValue(false);

    const callback = buildReadinessCallback({ db, kv })!;

    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
      data: { failures: ["kv"] },
    });
    expect(db.ping).toHaveBeenCalledTimes(1);
  });

  test("fails when a separately configured cache source is down", async () => {
    const kv = await createMockProteusSource();
    const cache = await createMockProteusSource();
    cache.ping.mockRejectedValue(new Error("cache down"));

    const callback = buildReadinessCallback({ kv, cache })!;

    await expect(callback({} as any)).rejects.toMatchObject({
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

    const callback = buildReadinessCallback({ bus, cache, db, kv })!;

    await callback({} as any);

    for (const source of [bus, cache, db, kv]) {
      expect(source.ping).toHaveBeenCalledTimes(1);
    }
  });

  test("passes when an unconfigured role is simply absent", async () => {
    const db = await createMockProteusSource();

    const callback = buildReadinessCallback({ db })!;

    await expect(callback({} as any)).resolves.toBeUndefined();
    expect(db.ping).toHaveBeenCalledTimes(1);
  });

  // `cache` falls back to `kv` when the deployment runs one ephemeral store, so
  // the SAME instance arrives under two roles — ping it once.
  test("does not double-ping when cache falls back to kv", async () => {
    const kv = await createMockProteusSource();

    const callback = buildReadinessCallback({ kv, cache: kv })!;

    await callback({} as any);

    expect(kv.ping).toHaveBeenCalledTimes(1);
  });

  test("reports a doubly-named instance under its first role only", async () => {
    const kv = await createMockProteusSource();
    kv.ping.mockResolvedValue(false);

    const callback = buildReadinessCallback({ kv, cache: kv })!;

    await expect(callback({} as any)).rejects.toMatchObject({
      code: "health_check_failed",
      data: { failures: ["kv"] },
    });
  });

  test("returns undefined when only unconfigurable roles are passed as undefined", () => {
    expect(
      buildReadinessCallback({
        bus: undefined,
        cache: undefined,
        db: undefined,
        kv: undefined,
      }),
    ).toBeUndefined();
  });

  test("returns a callback when only the cache role is configured", async () => {
    const cache = await createMockProteusSource();

    const callback = buildReadinessCallback({ cache })!;

    expect(callback).toBeDefined();

    await callback({} as any);

    expect(cache.ping).toHaveBeenCalledTimes(1);
  });
});

describe("buildLivenessCallback", () => {
  test("returns undefined when there is no I/O to check", () => {
    expect(buildLivenessCallback({})).toBeUndefined();
  });

  test("checks I/O once, then latches success and stops pinging", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();

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
