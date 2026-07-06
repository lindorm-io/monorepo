import type { ConduitResponse } from "../types/index.js";
import { createMemoryCacheDriver } from "./memory-cache-driver.js";
import { afterEach, describe, expect, test, vi } from "vitest";

const response: ConduitResponse = {
  data: { ok: true },
  status: 200,
  statusText: "OK",
  headers: {},
};

const keyOf = (query: unknown = {}) => ({
  method: "GET",
  url: "https://api.example.com/songs",
  query,
  body: undefined,
});

describe("createMemoryCacheDriver", () => {
  afterEach(() => vi.useRealTimers());

  test("returns null for an absent entry", async () => {
    const driver = createMemoryCacheDriver();
    expect(await driver.get(keyOf())).toBeNull();
  });

  test("round-trips a stored response with a numeric storedAt", async () => {
    const driver = createMemoryCacheDriver();
    await driver.set(keyOf(), response);

    const hit = await driver.get(keyOf());
    expect(hit?.response.data).toEqual({ ok: true });
    expect(typeof hit?.storedAt).toBe("number");
  });

  test("keys are order-independent", async () => {
    const driver = createMemoryCacheDriver();
    await driver.set(keyOf({ a: "1", b: "2" }), response);

    expect(await driver.get(keyOf({ b: "2", a: "1" }))).not.toBeNull();
  });

  test("expires an entry after its ttl", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));

    const driver = createMemoryCacheDriver();
    await driver.set(keyOf(), response, 1_000);
    expect(await driver.get(keyOf())).not.toBeNull();

    vi.setSystemTime(new Date("2026-01-01T00:00:02Z"));
    expect(await driver.get(keyOf())).toBeNull();
  });

  test("evicts the least-recently-used entry past maxEntries", async () => {
    const driver = createMemoryCacheDriver(2);
    await driver.set(keyOf({ n: "1" }), response);
    await driver.set(keyOf({ n: "2" }), response);

    // Touch #1 so #2 becomes the least-recently-used.
    await driver.get(keyOf({ n: "1" }));
    await driver.set(keyOf({ n: "3" }), response);

    expect(await driver.get(keyOf({ n: "2" }))).toBeNull();
    expect(await driver.get(keyOf({ n: "1" }))).not.toBeNull();
    expect(await driver.get(keyOf({ n: "3" }))).not.toBeNull();
  });
});
