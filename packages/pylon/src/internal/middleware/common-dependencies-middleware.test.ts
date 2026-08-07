import { createMockHermes } from "@lindorm/hermes/mocks/vitest";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { createDependenciesMiddleware } from "./common-dependencies-middleware.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("createDependenciesMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
  });

  test("should lazily create proteus session on first access", async () => {
    const proteus = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({ db: proteus as any });

    await middleware(ctx, vi.fn());

    expect(proteus.session).not.toHaveBeenCalled();

    const session = ctx.db;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledTimes(1);
    expect(proteus.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should forward ctx.signal to proteus.session when context is HTTP", async () => {
    const proteus = await createMockProteusSource();
    const controller = new AbortController();

    const httpCtx: any = {
      logger: createMockLogger(),
      request: {},
      signal: controller.signal,
    };

    const middleware = createDependenciesMiddleware({ db: proteus as any });

    await middleware(httpCtx, vi.fn());

    const session = httpCtx.db;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledWith({
      logger: httpCtx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
      signal: controller.signal,
    });
  });

  test("should pass signal: undefined to proteus.session for socket (non-HTTP) context", async () => {
    const proteus = await createMockProteusSource();

    const socketCtx: any = {
      logger: createMockLogger(),
      event: "test:event",
    };

    const middleware = createDependenciesMiddleware({ db: proteus as any });

    await middleware(socketCtx, vi.fn());

    const session = socketCtx.db;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledWith({
      logger: socketCtx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should lazily create the evictable cache session on first access", async () => {
    const cache = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({ cache: cache as any });

    await middleware(ctx, vi.fn());

    expect(cache.session).not.toHaveBeenCalled();

    const session = ctx.cache;

    expect(session).toBeDefined();
    expect(cache.session).toHaveBeenCalledTimes(1);
    expect(cache.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should keep ctx.cache and ctx.kv on their own sources", async () => {
    const cache = await createMockProteusSource();
    const kv = await createMockProteusSource();

    cache.session.mockReturnValue({ tag: "cache" } as any);
    kv.session.mockReturnValue({ tag: "kv" } as any);

    const middleware = createDependenciesMiddleware({
      cache: cache as any,
      kv: kv as any,
    });

    await middleware(ctx, vi.fn());

    expect(ctx.cache).toEqual({ tag: "cache" });
    expect(ctx.kv).toEqual({ tag: "kv" });
  });

  // On the fallback the caller hands the SAME source under both roles. Each role
  // still gets its own session, so session identity does not change the day the
  // stores are actually split — no consumer code moves.
  test("should give cache its own session even when it falls back to the kv source", async () => {
    const source = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({
      cache: source as any,
      kv: source as any,
    });

    await middleware(ctx, vi.fn());

    expect(ctx.cache).toBeDefined();
    expect(ctx.kv).toBeDefined();
    expect(ctx.cache).not.toBe(ctx.kv);
    expect(source.session).toHaveBeenCalledTimes(2);
  });

  // ⚠ `cache` is installed as a lazyFactory GETTER, exactly like `kv`. Building
  // the context must not open a session, and a helper that COPIES the context
  // must forward through a getter rather than spread — a spread evaluates every
  // getter on the object, which would open a session against the evictable store
  // on every request, including the ones that never cache.
  test("should not open a cache session when the context is merely built", async () => {
    const cache = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({ cache: cache as any });

    await middleware(ctx, vi.fn());

    expect(cache.session).not.toHaveBeenCalled();

    // A copy that FORWARDS — the createAuthDriverContext pattern. Still nothing
    // opened, right up until something reads it.
    const forwarded = {
      get cache() {
        return ctx.cache;
      },
    };

    expect(cache.session).not.toHaveBeenCalled();
    expect(forwarded.cache).toBeDefined();
    expect(cache.session).toHaveBeenCalledTimes(1);
  });

  // The other half of the same fact, pinned so nobody "simplifies"
  // createAuthDriverContext's getters into a spread: a spread DOES materialise.
  test("should prove a spread of the context evaluates the cache getter", async () => {
    const cache = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({ cache: cache as any });

    await middleware(ctx, vi.fn());

    expect(cache.session).not.toHaveBeenCalled();

    void { ...ctx };

    expect(cache.session).toHaveBeenCalledTimes(1);
  });

  test("should not install ctx.cache when no cache source is configured", async () => {
    const kv = await createMockProteusSource();

    const middleware = createDependenciesMiddleware({ kv: kv as any });

    await middleware(ctx, vi.fn());

    expect(ctx.cache).toBeUndefined();
  });

  test("should lazily create iris session on first access", async () => {
    const iris = await createMockIrisSource();

    const middleware = createDependenciesMiddleware({ bus: iris as any });

    await middleware(ctx, vi.fn());

    expect(iris.session).not.toHaveBeenCalled();

    const session = ctx.bus;

    expect(session).toBeDefined();
    expect(iris.session).toHaveBeenCalledTimes(1);
    expect(iris.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
    });
  });

  test("should lazily create hermes session on first access", async () => {
    const hermes = createMockHermes();

    const middleware = createDependenciesMiddleware({ hermes: hermes as any });

    await middleware(ctx, vi.fn());

    expect(hermes.session).not.toHaveBeenCalled();

    const session = ctx.hermes;

    expect(session).toBeDefined();
    expect(hermes.session).toHaveBeenCalledTimes(1);
    expect(hermes.session).toHaveBeenCalledWith({ logger: ctx.logger });
  });

  test("should resolve actor from top-level resolver and forward it in hook meta", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();
    const actor = vi.fn().mockReturnValue("alice@test.com");

    const ctxWithState: any = {
      logger: createMockLogger(),
      state: {
        actor: "unknown",
        metadata: {
          correlationId: "corr-abc",
          date: new Date("2025-01-01T00:00:00Z"),
        },
      },
    };

    const middleware = createDependenciesMiddleware({
      db: proteus as any,
      bus: iris as any,
      actor,
    });

    await middleware(ctxWithState, vi.fn());

    expect(actor).toHaveBeenCalledWith(ctxWithState);

    // Trigger both sessions
    ctxWithState.db;
    ctxWithState.bus;

    const expectedMeta = {
      correlationId: "corr-abc",
      actor: "alice@test.com",
      timestamp: new Date("2025-01-01T00:00:00Z"),
    };

    expect(proteus.session).toHaveBeenCalledWith({
      logger: ctxWithState.logger,
      meta: expectedMeta,
      signal: undefined,
    });
    expect(iris.session).toHaveBeenCalledWith({
      logger: ctxWithState.logger,
      meta: expectedMeta,
    });
  });

  test("should memoise actor on ctx.state.actor across session creation", async () => {
    const proteus = await createMockProteusSource();
    const iris = await createMockIrisSource();
    const actor = vi.fn().mockReturnValue("alice@test.com");

    const ctxWithState: any = {
      logger: createMockLogger(),
      state: {
        actor: "unknown",
        metadata: { correlationId: "c", date: new Date("2025-01-01T00:00:00Z") },
      },
    };

    const middleware = createDependenciesMiddleware({
      db: proteus as any,
      bus: iris as any,
      actor,
    });

    await middleware(ctxWithState, vi.fn());

    ctxWithState.db;
    ctxWithState.bus;

    expect(actor).toHaveBeenCalledTimes(1);
    expect(ctxWithState.state.actor).toBe("alice@test.com");
  });

  test("should handle no sources configured", async () => {
    const middleware = createDependenciesMiddleware({});

    await expect(middleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.db).toBeUndefined();
    expect(ctx.bus).toBeUndefined();
    expect(ctx.hermes).toBeUndefined();
  });

  describe("rooms", () => {
    test("should lazily create rooms via lazyFactory when roomsEnabled and socket context", async () => {
      const socketCtx: any = {
        logger: createMockLogger(),
        event: "test:event",
        io: {
          app: {
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
            in: vi.fn().mockReturnValue({ fetchSockets: vi.fn() }),
          },
          socket: {
            id: "s1",
            data: {},
            join: vi.fn(),
            leave: vi.fn(),
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
          },
        },
      };

      const middleware = createDependenciesMiddleware({ roomsEnabled: true });

      await middleware(socketCtx, vi.fn());

      expect(socketCtx.rooms).toBeDefined();
      expect(typeof socketCtx.rooms.join).toBe("function");
      expect(typeof socketCtx.rooms.leave).toBe("function");
      expect(typeof socketCtx.rooms.members).toBe("function");
    });

    test("should create rooms on HTTP context when roomsEnabled and io present", async () => {
      const httpCtx: any = {
        logger: createMockLogger(),
        request: {},
        io: {
          app: {
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
            in: vi.fn().mockReturnValue({ fetchSockets: vi.fn() }),
          },
        },
      };

      const middleware = createDependenciesMiddleware({ roomsEnabled: true });

      await middleware(httpCtx, vi.fn());

      expect(httpCtx.rooms).toBeDefined();
    });

    test("should not set rooms when no io present even when roomsEnabled", async () => {
      const middleware = createDependenciesMiddleware({ roomsEnabled: true });

      await middleware(ctx, vi.fn());

      expect(ctx.rooms).toBeUndefined();
    });

    test("should not set rooms when roomsEnabled is false", async () => {
      const socketCtx: any = {
        logger: createMockLogger(),
        event: "test:event",
        io: {
          app: {},
          socket: { id: "s1", data: {} },
        },
      };

      const middleware = createDependenciesMiddleware({ roomsEnabled: false });

      await middleware(socketCtx, vi.fn());

      expect(socketCtx.rooms).toBeUndefined();
    });

    // Presence is AUTHORITATIVE — an evicted record drops a live member — so it
    // reads `ctx.kv`, never `ctx.cache`. And `ctx.kv` is read INSIDE the rooms
    // lazyFactory, so a request that touches neither opens neither.
    test("should build presence on the kv session, opened only when rooms is touched", async () => {
      const kv = await createMockProteusSource();

      const socketCtx: any = {
        logger: createMockLogger(),
        event: "test:event",
        io: {
          app: {
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
            in: vi.fn().mockReturnValue({ fetchSockets: vi.fn() }),
          },
          socket: {
            id: "s1",
            data: {},
            join: vi.fn(),
            leave: vi.fn(),
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
          },
        },
      };

      const middleware = createDependenciesMiddleware({
        kv: kv as any,
        roomsEnabled: true,
        roomsPresence: true,
      });

      await middleware(socketCtx, vi.fn());

      // Neither `ctx.kv` nor `ctx.rooms` has been read yet.
      expect(kv.session).not.toHaveBeenCalled();

      const rooms = socketCtx.rooms;

      expect(rooms).toBeDefined();
      expect(typeof rooms.presence).toBe("function");
      expect(kv.session).toHaveBeenCalledTimes(1);
    });

    test("should omit presence and leave kv unopened when roomsPresence is off", async () => {
      const kv = await createMockProteusSource();

      const socketCtx: any = {
        logger: createMockLogger(),
        event: "test:event",
        io: {
          app: {
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
            in: vi.fn().mockReturnValue({ fetchSockets: vi.fn() }),
          },
          socket: {
            id: "s1",
            data: {},
            join: vi.fn(),
            leave: vi.fn(),
            to: vi.fn().mockReturnValue({ emit: vi.fn() }),
          },
        },
      };

      const middleware = createDependenciesMiddleware({
        kv: kv as any,
        roomsEnabled: true,
        roomsPresence: false,
      });

      await middleware(socketCtx, vi.fn());

      const rooms = socketCtx.rooms;

      expect(rooms).toBeDefined();
      expect(rooms.presence).toBeUndefined();
      expect(kv.session).not.toHaveBeenCalled();
    });
  });
});
