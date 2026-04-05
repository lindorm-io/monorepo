import { createMockIrisSource } from "@lindorm/iris/mocks";
import { createMockLogger } from "@lindorm/logger";
import { createMockProteusSource } from "@lindorm/proteus/mocks";
import { RATE_LIMIT_SOURCE, ROOMS_SOURCE } from "../constants/symbols";
import { createSourcesMiddleware } from "./common-sources-middleware";

describe("createSourcesMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
    };
  });

  test("should clone proteus source onto context", async () => {
    const proteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({ proteus: proteus as any });

    await middleware(ctx, jest.fn());

    expect(proteus.clone).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
    expect(ctx.proteus).toBeDefined();
  });

  test("should clone iris source onto context", async () => {
    const iris = createMockIrisSource();

    const middleware = createSourcesMiddleware({ iris: iris as any });

    await middleware(ctx, jest.fn());

    expect(iris.clone).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
    expect(ctx.iris).toBeDefined();
  });

  test("should clone hermes onto context", async () => {
    const hermes = { clone: jest.fn().mockReturnValue("cloned") };

    const middleware = createSourcesMiddleware({ hermes: hermes as any });

    await middleware(ctx, jest.fn());

    expect(hermes.clone).toHaveBeenCalledWith({ logger: ctx.logger });
    expect(ctx.hermes).toEqual("cloned");
  });

  test("should handle no sources configured", async () => {
    const middleware = createSourcesMiddleware({});

    await expect(middleware(ctx, jest.fn())).resolves.toBeUndefined();

    expect(ctx.proteus).toBeUndefined();
    expect(ctx.iris).toBeUndefined();
    expect(ctx.hermes).toBeUndefined();
  });

  test("should store raw rateLimitProteus on context via symbol (lazy clone)", async () => {
    const rateLimitProteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({
      rateLimitProteus: rateLimitProteus as any,
    });

    await middleware(ctx, jest.fn());

    expect(rateLimitProteus.clone).not.toHaveBeenCalled();
    expect(ctx[RATE_LIMIT_SOURCE]).toBe(rateLimitProteus);
  });

  test("should store raw roomsProteus on context via symbol (lazy clone)", async () => {
    const roomsProteus = createMockProteusSource();

    const middleware = createSourcesMiddleware({ roomsProteus: roomsProteus as any });

    await middleware(ctx, jest.fn());

    expect(roomsProteus.clone).not.toHaveBeenCalled();
    expect(ctx[ROOMS_SOURCE]).toBe(roomsProteus);
  });

  test("should not set rate limit symbol when rateLimitProteus not provided", async () => {
    const middleware = createSourcesMiddleware({});

    await middleware(ctx, jest.fn());

    expect(ctx[RATE_LIMIT_SOURCE]).toBeUndefined();
  });

  test("should not set rooms symbol when roomsProteus not provided", async () => {
    const middleware = createSourcesMiddleware({});

    await middleware(ctx, jest.fn());

    expect(ctx[ROOMS_SOURCE]).toBeUndefined();
  });
});
