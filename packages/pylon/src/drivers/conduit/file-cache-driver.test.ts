import type { ConduitCacheKey, ConduitResponse } from "@lindorm/conduit";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { createFileCacheDriver } from "./file-cache-driver.js";

describe("createFileCacheDriver", () => {
  let dir: string;

  const key: ConduitCacheKey = {
    method: "GET",
    url: "https://api.example.com/v1/songs",
    query: { q: "x" },
    body: undefined,
  };

  const response: ConduitResponse = {
    data: { ok: true },
    status: 200,
    statusText: "OK",
    headers: {},
  };

  // Deterministic layout for the fixed request above: dir/<host>/<slug>.
  const captureDir = () => join(dir, "api.example.com", "v1-songs");

  beforeEach(async () => {
    dir = await mkdtemp(join(tmpdir(), "conduit-file-driver-"));
  });

  afterEach(async () => {
    vi.useRealTimers();
    await rm(dir, { recursive: true, force: true });
  });

  test("miss: returns null for an unknown request", async () => {
    const driver = createFileCacheDriver(dir);

    expect(await driver.get(key)).toBeNull();
  });

  test("set: writes a browsable capture and leaves no temp files", async () => {
    const driver = createFileCacheDriver(dir);

    await driver.set(key, response);

    const files = await readdir(captureDir());

    expect(files).toHaveLength(1);
    expect(files.every((name) => !name.endsWith(".tmp"))).toBe(true);

    const captured = JSON.parse(await readFile(join(captureDir(), files[0]!), "utf8"));

    expect(captured).toMatchObject({
      expiresAt: null,
      request: {
        method: "GET",
        url: "https://api.example.com/v1/songs",
        query: { q: "x" },
      },
      response,
    });
    expect(typeof captured.fetchedAt).toBe("string");
  });

  test("hit: returns the stored response and storedAt", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const driver = createFileCacheDriver(dir);
    await driver.set(key, response);

    const hit = await driver.get(key);

    expect(hit).toEqual({ response, storedAt: Date.parse("2026-01-01T00:00:00.000Z") });
  });

  test("expiry: a ttl'd entry becomes a miss once elapsed", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const driver = createFileCacheDriver(dir);
    await driver.set(key, response, 1000);

    // Still fresh just before expiry.
    vi.setSystemTime(new Date("2026-01-01T00:00:00.999Z"));
    expect(await driver.get(key)).not.toBeNull();

    // Expired at the boundary (>=).
    vi.setSystemTime(new Date("2026-01-01T00:00:01.000Z"));
    expect(await driver.get(key)).toBeNull();
  });

  test("get: corrupt capture is treated as a miss, not an error", async () => {
    const driver = createFileCacheDriver(dir);
    await driver.set(key, response);

    const files = await readdir(captureDir());
    // Replace with unparseable content.
    await writeFile(join(captureDir(), files[0]!), "{ not json", "utf8");

    expect(await driver.get(key)).toBeNull();
  });
});
