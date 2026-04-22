import { createMockHermes } from "@lindorm/hermes/mocks/vitest";
import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { RATE_LIMIT_SOURCE } from "../constants/symbols.js";
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
    const proteus = createMockProteusSource();

    const middleware = createDependenciesMiddleware({ proteus: proteus as any });

    await middleware(ctx, vi.fn());

    expect(proteus.session).not.toHaveBeenCalled();

    const session = ctx.proteus;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledTimes(1);
    expect(proteus.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      context: {
        correlationId: "unknown",
        actor: null,
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should forward ctx.signal to proteus.session when context is HTTP", async () => {
    const proteus = createMockProteusSource();
    const controller = new AbortController();

    const httpCtx: any = {
      logger: createMockLogger(),
      request: {},
      signal: controller.signal,
    };

    const middleware = createDependenciesMiddleware({ proteus: proteus as any });

    await middleware(httpCtx, vi.fn());

    const session = httpCtx.proteus;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledWith({
      logger: httpCtx.logger,
      context: {
        correlationId: "unknown",
        actor: null,
        timestamp: expect.any(Date),
      },
      signal: controller.signal,
    });
  });

  test("should pass signal: undefined to proteus.session for socket (non-HTTP) context", async () => {
    const proteus = createMockProteusSource();

    const socketCtx: any = {
      logger: createMockLogger(),
      event: "test:event",
    };

    const middleware = createDependenciesMiddleware({ proteus: proteus as any });

    await middleware(socketCtx, vi.fn());

    const session = socketCtx.proteus;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledWith({
      logger: socketCtx.logger,
      context: {
        correlationId: "unknown",
        actor: null,
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should lazily create iris session on first access", async () => {
    const iris = createMockIrisSource();

    const middleware = createDependenciesMiddleware({ iris: iris as any });

    await middleware(ctx, vi.fn());

    expect(iris.session).not.toHaveBeenCalled();

    const session = ctx.iris;

    expect(session).toBeDefined();
    expect(iris.session).toHaveBeenCalledTimes(1);
    expect(iris.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      context: {
        correlationId: "unknown",
        actor: null,
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

  test("should resolve actor from auditConfig and forward it in hook meta", async () => {
    const proteus = createMockProteusSource();
    const iris = createMockIrisSource();
    const actor = vi.fn().mockReturnValue("alice@test.com");

    const ctxWithState: any = {
      logger: createMockLogger(),
      state: {
        metadata: {
          correlationId: "corr-abc",
          date: new Date("2025-01-01T00:00:00Z"),
        },
      },
    };

    const middleware = createDependenciesMiddleware({
      proteus: proteus as any,
      iris: iris as any,
      auditConfig: {
        iris: iris as any,
        actor,
      },
    });

    await middleware(ctxWithState, vi.fn());

    expect(actor).toHaveBeenCalledWith(ctxWithState);

    // Trigger both sessions
    ctxWithState.proteus;
    ctxWithState.iris;

    const expectedContext = {
      correlationId: "corr-abc",
      actor: "alice@test.com",
      timestamp: new Date("2025-01-01T00:00:00Z"),
    };

    expect(proteus.session).toHaveBeenCalledWith({
      logger: ctxWithState.logger,
      context: expectedContext,
      signal: undefined,
    });
    expect(iris.session).toHaveBeenCalledWith({
      logger: ctxWithState.logger,
      context: expectedContext,
    });
  });

  test("should handle no sources configured", async () => {
    const middleware = createDependenciesMiddleware({});

    await expect(middleware(ctx, vi.fn())).resolves.toBeUndefined();

    expect(ctx.proteus).toBeUndefined();
    expect(ctx.iris).toBeUndefined();
    expect(ctx.hermes).toBeUndefined();
  });

  test("should store raw rateLimitProteus on context via symbol (lazy session)", async () => {
    const rateLimitProteus = createMockProteusSource();

    const middleware = createDependenciesMiddleware({
      rateLimitProteus: rateLimitProteus as any,
    });

    await middleware(ctx, vi.fn());

    expect(rateLimitProteus.session).not.toHaveBeenCalled();
    expect(ctx[RATE_LIMIT_SOURCE]).toBe(rateLimitProteus);
  });

  test("should not set rate limit symbol when rateLimitProteus not provided", async () => {
    const middleware = createDependenciesMiddleware({});

    await middleware(ctx, vi.fn());

    expect(ctx[RATE_LIMIT_SOURCE]).toBeUndefined();
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

    test("should pass roomsProteus and roomsPresence to room context factory", async () => {
      const roomsProteus = createMockProteusSource();

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
        roomsEnabled: true,
        roomsPresence: true,
        roomsProteus: roomsProteus as any,
      });

      await middleware(socketCtx, vi.fn());

      const rooms = socketCtx.rooms;

      expect(rooms).toBeDefined();
      expect(typeof rooms.presence).toBe("function");
    });
  });
});
