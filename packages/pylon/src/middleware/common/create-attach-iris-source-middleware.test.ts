import { createMockIrisSource } from "@lindorm/iris/mocks/vitest";
import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createAttachIrisSourceMiddleware } from "./create-attach-iris-source-middleware.js";

describe("createAttachIrisSourceMiddleware", () => {
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
  });

  test("should call next", async () => {
    const source = createMockIrisSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachIrisSourceMiddleware({ key: "iris", source: source as any })(
      ctx,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should lazily bind session to ctx[key] on first access", async () => {
    const source = createMockIrisSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachIrisSourceMiddleware({ key: "analytics", source: source as any })(
      ctx,
      next,
    );

    expect(source.session).not.toHaveBeenCalled();

    const session = ctx.analytics;

    expect(session).toBeDefined();
    expect(source.session).toHaveBeenCalledTimes(1);
    expect(source.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "unknown",
        actor: "unknown",
        timestamp: expect.any(Date),
      },
    });
  });

  test("should never thread a signal key (iris has no AbortSignal)", async () => {
    const source = createMockIrisSource();
    const controller = new AbortController();
    const ctx: any = {
      logger: createMockLogger(),
      request: {},
      signal: controller.signal,
    };

    await createAttachIrisSourceMiddleware({ key: "iris", source: source as any })(
      ctx,
      next,
    );

    ctx.iris;

    const call = source.session.mock.calls[0][0];

    expect(call).not.toHaveProperty("signal");
  });

  test("should cache session on second access", async () => {
    const source = createMockIrisSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachIrisSourceMiddleware({ key: "iris", source: source as any })(
      ctx,
      next,
    );

    const first = ctx.iris;
    const second = ctx.iris;

    expect(source.session).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  test("should resolve actor via the actor callback and forward it in hook meta", async () => {
    const source = createMockIrisSource();
    const actor = vi.fn().mockReturnValue("alice@test.com");

    const ctx: any = {
      logger: createMockLogger(),
      state: {
        metadata: {
          correlationId: "corr-abc",
          date: new Date("2025-01-01T00:00:00Z"),
        },
      },
    };

    await createAttachIrisSourceMiddleware({
      key: "iris",
      source: source as any,
      actor,
    })(ctx, next);

    ctx.iris;

    expect(actor).toHaveBeenCalledWith(ctx);
    expect(source.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "corr-abc",
        actor: "alice@test.com",
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
    });
  });

  test("should forward 'unknown' actor from the configured resolver into hook meta", async () => {
    const source = createMockIrisSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachIrisSourceMiddleware({
      key: "iris",
      source: source as any,
      actor: () => "unknown",
    })(ctx, next);

    ctx.iris;

    expect(source.session).toHaveBeenCalledWith(
      expect.objectContaining({
        meta: expect.objectContaining({ actor: "unknown" }),
      }),
    );
  });
});
