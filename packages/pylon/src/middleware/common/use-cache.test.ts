import { ServerError } from "@lindorm/errors";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { CACHE_SOURCE } from "../../internal/constants/symbols.js";
import { useCache } from "./use-cache.js";

const delay = (timeout: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, timeout));

type FakeSource = {
  source: any;
  repository: { findOne: ReturnType<typeof vi.fn>; upsert: ReturnType<typeof vi.fn> };
  store: Map<string, any>;
  setFailRead: (value: boolean) => void;
  setFailWrite: (value: boolean) => void;
};

const createFakeSource = (): FakeSource => {
  const store = new Map<string, any>();
  let failRead = false;
  let failWrite = false;

  const repository = {
    findOne: vi.fn(async ({ id }: { id: string }) => {
      if (failRead) throw new Error("cache backend down (read)");
      return store.get(id) ?? null;
    }),
    upsert: vi.fn(async (entity: any) => {
      if (failWrite) throw new Error("cache backend down (write)");
      store.set(entity.id, entity);
      return entity;
    }),
  };

  const session = { repository: vi.fn(() => repository) };
  const source = { driverType: "memory", session: vi.fn(() => session) };

  return {
    source,
    repository,
    store,
    setFailRead: (value: boolean) => (failRead = value),
    setFailWrite: (value: boolean) => (failWrite = value),
  };
};

type CtxConfig = {
  source?: any;
  method?: string;
  path?: string;
  data?: any;
  headers?: Record<string, string>;
  actor?: string;
  environment?: string;
};

const createCtx = (config: CtxConfig = {}): any => {
  const headers = config.headers ?? {};
  const responseHeaders: Record<string, string> = {};

  const ctx: any = {
    method: config.method ?? "GET",
    path: config.path ?? "/items",
    data: config.data ?? {},
    status: 404,
    body: undefined,
    request: {},
    logger: createMockLogger(),
    state: {
      actor: config.actor ?? "unknown",
      app: { environment: config.environment ?? "test" },
    },
    get: (name: string) => headers[name.toLowerCase()],
    set: (name: string, value: string) => {
      responseHeaders[name] = value;
    },
    response: { get: (name: string) => responseHeaders[name] },
    responseHeaders,
  };

  ctx[CACHE_SOURCE] = config.source;

  return ctx;
};

// A handler is passed as `next` and invoked with no arguments, so it must
// close over the ctx it writes to.
const handlerFor = (ctx: any, status: number, body: unknown) =>
  vi.fn(async () => {
    ctx.status = status;
    ctx.body = body;
  });

describe("useCache", () => {
  let fake: FakeSource;

  beforeEach(() => {
    fake = createFakeSource();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  test("should MISS then store the response", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });

    await mw(ctx, handlerFor(ctx, 200, { hello: "world" }));

    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("MISS");
    expect(fake.repository.upsert).toHaveBeenCalledTimes(1);
    expect(fake.store.size).toBe(1);
  });

  test("should HIT and replay status and body on a second request", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source });
    await mw(first, handlerFor(first, 201, { value: 42 }));

    const second = createCtx({ source: fake.source });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(second.status).toBe(201);
    expect(second.body).toEqual({ value: 42 });
  });

  test("should emit X-Pylon-Cache, ETag, Cache-Control, Age and X-Pylon-Cache-Source headers", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });

    await mw(ctx, handlerFor(ctx, 200, { hello: "world" }));

    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("MISS");
    expect(ctx.responseHeaders["ETag"]).toMatch(/^".+"$/);
    expect(ctx.responseHeaders["Cache-Control"]).toBe("public, max-age=60");
    expect(ctx.responseHeaders["Age"]).toBe("0");
    expect(ctx.responseHeaders["X-Pylon-Cache-Source"]).toBe("memory");
  });

  test("should NOT emit X-Pylon-Cache-Source in production", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source, environment: "production" });

    await mw(ctx, handlerFor(ctx, 200, { hello: "world" }));

    expect(ctx.responseHeaders["X-Pylon-Cache-Source"]).toBeUndefined();
  });

  test("should compute Age from the stored representation on a HIT", async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-01-01T00:00:00.000Z"));

    const mw = useCache("60s", "public");
    const first = createCtx({ source: fake.source });
    await mw(first, handlerFor(first, 200, { ok: true }));

    vi.setSystemTime(new Date("2026-01-01T00:00:05.000Z"));
    const hit = createCtx({ source: fake.source });
    await mw(hit, vi.fn());

    expect(hit.responseHeaders["Age"]).toBe("5");
  });

  test("should emit a Vary header when configured", async () => {
    const mw = useCache("60s", "public", { vary: ["Accept-Language"] });
    const ctx = createCtx({ source: fake.source, headers: { "accept-language": "en" } });

    await mw(ctx, handlerFor(ctx, 200, { hello: "world" }));

    expect(ctx.responseHeaders["Vary"]).toBe("Accept-Language");
  });

  test("should fold the actor into the key for private scope (two actors -> two entries)", async () => {
    const mw = useCache("60s", "private");

    const a = createCtx({ source: fake.source, actor: "actor-1" });
    await mw(a, handlerFor(a, 200, { a: 1 }));

    const b = createCtx({ source: fake.source, actor: "actor-2" });
    await mw(b, handlerFor(b, 200, { a: 2 }));

    expect(fake.store.size).toBe(2);
  });

  test("should serve a per-actor HIT for private scope", async () => {
    const mw = useCache("60s", "private");

    const first = createCtx({ source: fake.source, actor: "actor-1" });
    await mw(first, handlerFor(first, 200, { secret: "one" }));

    const second = createCtx({ source: fake.source, actor: "actor-1" });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.body).toEqual({ secret: "one" });
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
  });

  test("should key on a custom per-route actor, overriding the request actor", async () => {
    // Two different request actors, but a custom resolver collapses them to one
    // identity → one shared entry, second request HITs.
    const mw = useCache("60s", "private", { actor: () => "tenant-x" });

    const first = createCtx({ source: fake.source, actor: "actor-1" });
    await mw(first, handlerFor(first, 200, { v: 1 }));

    const second = createCtx({ source: fake.source, actor: "actor-2" });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(fake.store.size).toBe(1);
  });

  test("should NOT cache a private response when no actor can be resolved", async () => {
    const mw = useCache("60s", "private");
    const ctx = createCtx({ source: fake.source, actor: "unknown" });
    const handler = handlerFor(ctx, 200, { hello: "world" });

    await mw(ctx, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("DYNAMIC");
    expect(fake.repository.findOne).not.toHaveBeenCalled();
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });

  test("should share a public entry across actors", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source, actor: "actor-1" });
    await mw(first, handlerFor(first, 200, { shared: true }));

    const second = createCtx({ source: fake.source, actor: "actor-2" });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(fake.store.size).toBe(1);
  });

  test("should collapse reordered data keys to one entry (sortKeys)", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source, data: { a: 1, b: 2 } });
    await mw(first, handlerFor(first, 200, { ok: true }));

    const second = createCtx({ source: fake.source, data: { b: 2, a: 1 } });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(fake.store.size).toBe(1);
  });

  test("should respond 304 when If-None-Match matches the stored etag", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source });
    await mw(first, handlerFor(first, 200, { hello: "world" }));
    const etag = first.responseHeaders["ETag"];

    const second = createCtx({ source: fake.source, headers: { "if-none-match": etag } });
    const handler = vi.fn();
    await mw(second, handler);

    expect(handler).not.toHaveBeenCalled();
    expect(second.status).toBe(304);
    expect(second.body).toBeNull();
    expect(second.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(second.responseHeaders["ETag"]).toBe(etag);
  });

  test("should respond 304 when If-None-Match is a wildcard", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source });
    await mw(first, handlerFor(first, 200, { hello: "world" }));

    const second = createCtx({ source: fake.source, headers: { "if-none-match": "*" } });
    await mw(second, vi.fn());

    expect(second.status).toBe(304);
  });

  test("should bypass entirely on a no-store request", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({
      source: fake.source,
      headers: { "cache-control": "no-store" },
    });
    const handler = handlerFor(ctx, 200, { hello: "world" });

    await mw(ctx, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("BYPASS");
    expect(fake.repository.findOne).not.toHaveBeenCalled();
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });

  test("should skip the read and refresh the entry on a no-cache request", async () => {
    const mw = useCache("60s", "public");

    const first = createCtx({ source: fake.source });
    await mw(first, handlerFor(first, 200, { version: 1 }));

    fake.repository.findOne.mockClear();

    const refresh = createCtx({
      source: fake.source,
      headers: { "cache-control": "no-cache" },
    });
    const handler = handlerFor(refresh, 200, { version: 2 });
    await mw(refresh, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(fake.repository.findOne).not.toHaveBeenCalled();
    expect(refresh.responseHeaders["X-Pylon-Cache"]).toBe("MISS");

    const stored = [...fake.store.values()][0];
    expect(stored.payload.body).toEqual({ version: 2 });
  });

  test("should not store a 3xx response", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });

    await mw(ctx, handlerFor(ctx, 302, { redirect: true }));

    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("DYNAMIC");
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });

  test("should not store a >=400 response", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });

    await mw(ctx, handlerFor(ctx, 404, { error: "nope" }));

    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("DYNAMIC");
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });

  test("should not store a streaming response", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });

    await mw(ctx, handlerFor(ctx, 200, { pipe: () => undefined }));

    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("DYNAMIC");
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });

  test("should degrade to the handler on a read failure", async () => {
    fake.setFailRead(true);
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });
    const handler = handlerFor(ctx, 200, { hello: "world" });

    await expect(mw(ctx, handler)).resolves.toBeUndefined();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.body).toEqual({ hello: "world" });
  });

  test("should degrade to the handler on a write failure", async () => {
    fake.setFailWrite(true);
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: fake.source });
    const handler = handlerFor(ctx, 200, { hello: "world" });

    await expect(mw(ctx, handler)).resolves.toBeUndefined();

    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.body).toEqual({ hello: "world" });
    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("MISS");
  });

  test("should throw ServerError when the cache source is not configured", async () => {
    const mw = useCache("60s", "public");
    const ctx = createCtx({ source: undefined });
    const handler = vi.fn();

    await expect(mw(ctx, handler)).rejects.toThrow(ServerError);
    expect(handler).not.toHaveBeenCalled();
  });

  test("should coalesce two concurrent misses into a single handler invocation", async () => {
    const mw = useCache("60s", "public");

    let invocations = 0;
    const makeNext = (ctx: any) => async () => {
      invocations++;
      await delay(20);
      ctx.status = 200;
      ctx.body = { coalesced: true };
    };

    const ctxA = createCtx({ source: fake.source });
    const ctxB = createCtx({ source: fake.source });

    await Promise.all([mw(ctxA, makeNext(ctxA)), mw(ctxB, makeNext(ctxB))]);

    expect(invocations).toBe(1);
    expect(ctxA.responseHeaders["X-Pylon-Cache"]).toBe("MISS");
    expect(ctxB.responseHeaders["X-Pylon-Cache"]).toBe("HIT");
    expect(ctxB.body).toEqual({ coalesced: true });
  });

  test("should fall back to an independent handler run when the originator is not cacheable", async () => {
    const mw = useCache("60s", "public");

    let invocations = 0;
    const makeNext = (ctx: any, status: number) => async () => {
      invocations++;
      await delay(20);
      ctx.status = status;
      ctx.body = { value: status };
    };

    const ctxA = createCtx({ source: fake.source });
    const ctxB = createCtx({ source: fake.source });

    // Originator returns a non-cacheable 500; the coalesced waiter must run next() itself.
    await Promise.all([mw(ctxA, makeNext(ctxA, 500)), mw(ctxB, makeNext(ctxB, 500))]);

    expect(invocations).toBe(2);
    expect(ctxB.responseHeaders["X-Pylon-Cache"]).toBe("DYNAMIC");
  });

  test("should skip caching when the skip predicate returns true", async () => {
    const mw = useCache("60s", "public", { skip: () => true });
    const ctx = createCtx({ source: fake.source });
    const handler = handlerFor(ctx, 200, { hello: "world" });

    await mw(ctx, handler);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(ctx.responseHeaders["X-Pylon-Cache"]).toBe("BYPASS");
    expect(fake.repository.findOne).not.toHaveBeenCalled();
    expect(fake.repository.upsert).not.toHaveBeenCalled();
  });
});
