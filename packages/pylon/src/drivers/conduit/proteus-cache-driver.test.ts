import type { ConduitCacheKey, ConduitResponse } from "@lindorm/conduit";
import type { IProteusSource } from "@lindorm/proteus";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { cacheId } from "./canonical.js";
import { createProteusCacheDriver } from "./proteus-cache-driver.js";

// A faithful stand-in for a redis proteus source: a stable repository over a
// backing Map, so `session().repository()` always resolves the same store. The
// generated vitest mock hands out a fresh repository per call, which defeats
// call assertions — this mirrors the fake used in use-cache.test.ts instead.
const createFakeSource = () => {
  const store = new Map<string, any>();

  const repository = {
    findOne: vi.fn(async ({ id }: { id: string }) => store.get(id) ?? null),
    upsert: vi.fn(async (entity: any) => {
      store.set(entity.id, entity);
      return entity;
    }),
  };

  const session = { repository: vi.fn(() => repository) };
  const source = { session: vi.fn(() => session) };

  return { source: source as unknown as IProteusSource, repository, store };
};

describe("createProteusCacheDriver", () => {
  const key: ConduitCacheKey = {
    method: "GET",
    url: "https://api.example.com/v1/songs",
    query: { q: "x" },
    body: undefined,
  };

  const response: ConduitResponse = {
    cached: null,
    data: { ok: true },
    status: 200,
    statusText: "OK",
    headers: {},
  };

  afterEach(() => {
    vi.useRealTimers();
  });

  describe("set", () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));
    });

    test("upserts the canonical id, payload, and no expiry when ttl is omitted", async () => {
      const { source, repository } = createFakeSource();
      const driver = createProteusCacheDriver(source);

      await driver.set(key, response);

      expect(repository.upsert).toHaveBeenCalledWith({
        id: cacheId(key),
        payload: response,
        expiresAt: null,
      });
    });

    test("derives expiresAt from the ttl when provided", async () => {
      const { source, repository } = createFakeSource();
      const driver = createProteusCacheDriver(source);

      await driver.set(key, response, 60_000);

      expect(repository.upsert).toHaveBeenCalledWith({
        id: cacheId(key),
        payload: response,
        expiresAt: new Date("2026-01-01T00:01:00.000Z"),
      });
    });
  });

  describe("get", () => {
    test("returns null when the entry is absent", async () => {
      const { source, repository } = createFakeSource();
      const driver = createProteusCacheDriver(source);

      const result = await driver.get(key);

      expect(result).toBeNull();
      expect(repository.findOne).toHaveBeenCalledWith({ id: cacheId(key) });
    });

    test("maps a stored entity to { response, storedAt }", async () => {
      const { source, store } = createFakeSource();
      const driver = createProteusCacheDriver(source);

      const createdAt = new Date("2026-01-01T00:00:00.000Z");
      store.set(cacheId(key), { id: cacheId(key), payload: response, createdAt });

      const result = await driver.get(key);

      expect(result).toEqual({ response, storedAt: createdAt.getTime() });
    });
  });
});
