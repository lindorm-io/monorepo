import { createMockHermes } from "@lindorm/hermes/mocks";
import { createMockIrisSource } from "@lindorm/iris/mocks";
import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { RATE_LIMIT_SOURCE } from "../constants/symbols";
import { createSourcesMiddleware } from "./common-sources-middleware";

describe("createSourcesMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
  });

  test("should lazily create proteus session on first access", async () => {
    const proteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({ proteus: proteus as any });

    await middleware(ctx, jest.fn());

    expect(proteus.session).not.toHaveBeenCalled();

    const session = ctx.proteus;

    expect(session).toBeDefined();
    expect(proteus.session).toHaveBeenCalledTimes(1);
    expect(proteus.session).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
  });

  test("should lazily create iris session on first access", async () => {
    const iris = createMockIrisSource();

    const middleware = createSourcesMiddleware({ iris: iris as any });

    await middleware(ctx, jest.fn());

    expect(iris.session).not.toHaveBeenCalled();

    const session = ctx.iris;

    expect(session).toBeDefined();
    expect(iris.session).toHaveBeenCalledTimes(1);
    expect(iris.session).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
  });

  test("should lazily create hermes session on first access", async () => {
    const hermes = createMockHermes();

    const middleware = createSourcesMiddleware({ hermes: hermes as any });

    await middleware(ctx, jest.fn());

    expect(hermes.session).not.toHaveBeenCalled();

    const session = ctx.hermes;

    expect(session).toBeDefined();
    expect(hermes.session).toHaveBeenCalledTimes(1);
    expect(hermes.session).toHaveBeenCalledWith({ logger: ctx.logger });
  });

  test("should handle no sources configured", async () => {
    const middleware = createSourcesMiddleware({});

    await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.proteus).toBeUndefined();
    expect(ctx.iris).toBeUndefined();
    expect(ctx.hermes).toBeUndefined();
  });

  test("should store raw rateLimitProteus on context via symbol (lazy session)", async () => {
    const rateLimitProteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({
      rateLimitProteus: rateLimitProteus as any,
    });

    await middleware(ctx, jest.fn());

    expect(rateLimitProteus.session).not.toHaveBeenCalled();
    expect(ctx[RATE_LIMIT_SOURCE]).toBe(rateLimitProteus);
  });

  test("should not set rate limit symbol when rateLimitProteus not provided", async () => {
    const middleware = createSourcesMiddleware({});

    await middleware(ctx, jest.fn());

    expect(ctx[RATE_LIMIT_SOURCE]).toBeUndefined();
  });

  describe("rooms", () => {
    test("should lazily create rooms via lazyFactory when roomsEnabled and socket context", async () => {
      const socketCtx: any = {
        logger: createMockLogger(),
        socket: {
          id: "s1",
          data: {},
          join: jest.fn(),
          leave: jest.fn(),
          to: jest.fn().mockReturnValue({ emit: jest.fn() }),
        },
        io: {
          to: jest.fn().mockReturnValue({ emit: jest.fn() }),
          in: jest.fn().mockReturnValue({ fetchSockets: jest.fn() }),
        },
      };

      const middleware = createSourcesMiddleware({ roomsEnabled: true });

      await middleware(socketCtx, jest.fn());

      expect(socketCtx.rooms).toBeDefined();
      expect(typeof socketCtx.rooms.join).toBe("function");
      expect(typeof socketCtx.rooms.leave).toBe("function");
      expect(typeof socketCtx.rooms.broadcast).toBe("function");
      expect(typeof socketCtx.rooms.emit).toBe("function");
      expect(typeof socketCtx.rooms.members).toBe("function");
    });

    test("should not set rooms on non-socket context even when roomsEnabled", async () => {
      const middleware = createSourcesMiddleware({ roomsEnabled: true });

      await middleware(ctx, jest.fn());

      expect(ctx.rooms).toBeUndefined();
    });

    test("should not set rooms when roomsEnabled is false", async () => {
      const socketCtx: any = {
        logger: createMockLogger(),
        socket: { id: "s1", data: {} },
        io: {},
      };

      const middleware = createSourcesMiddleware({ roomsEnabled: false });

      await middleware(socketCtx, jest.fn());

      expect(socketCtx.rooms).toBeUndefined();
    });

    test("should pass roomsProteus and roomsPresence to room context factory", async () => {
      const roomsProteus = createMockProteusSource();

      const socketCtx: any = {
        logger: createMockLogger(),
        socket: {
          id: "s1",
          data: {},
          join: jest.fn(),
          leave: jest.fn(),
          to: jest.fn().mockReturnValue({ emit: jest.fn() }),
        },
        io: {
          to: jest.fn().mockReturnValue({ emit: jest.fn() }),
          in: jest.fn().mockReturnValue({ fetchSockets: jest.fn() }),
        },
      };

      const middleware = createSourcesMiddleware({
        roomsEnabled: true,
        roomsPresence: true,
        roomsProteus: roomsProteus as any,
      });

      await middleware(socketCtx, jest.fn());

      const rooms = socketCtx.rooms;

      expect(rooms).toBeDefined();
      expect(typeof rooms.presence).toBe("function");
    });
  });
});
