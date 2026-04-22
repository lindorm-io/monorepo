import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createMockProteusSource } from "@lindorm/proteus/mocks/vitest";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";
import { createAttachProteusSourceMiddleware } from "./create-attach-proteus-source-middleware.js";

describe("createAttachProteusSourceMiddleware", () => {
  let next: Mock;

  beforeEach(() => {
    next = vi.fn();
  });

  test("should call next", async () => {
    const source = createMockProteusSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachProteusSourceMiddleware({ key: "proteus", source: source as any })(
      ctx,
      next,
    );

    expect(next).toHaveBeenCalledTimes(1);
  });

  test("should lazily bind session to ctx[key] on first access", async () => {
    const source = createMockProteusSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachProteusSourceMiddleware({
      key: "analytics",
      source: source as any,
    })(ctx, next);

    expect(source.session).not.toHaveBeenCalled();

    const session = ctx.analytics;

    expect(session).toBeDefined();
    expect(source.session).toHaveBeenCalledTimes(1);
    expect(source.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "unknown",
        actor: null,
        timestamp: expect.any(Date),
      },
      signal: undefined,
    });
  });

  test("should cache session on second access", async () => {
    const source = createMockProteusSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachProteusSourceMiddleware({ key: "proteus", source: source as any })(
      ctx,
      next,
    );

    const first = ctx.proteus;
    const second = ctx.proteus;

    expect(source.session).toHaveBeenCalledTimes(1);
    expect(first).toBe(second);
  });

  test("should forward ctx.signal when context is HTTP", async () => {
    const source = createMockProteusSource();
    const controller = new AbortController();
    const ctx: any = {
      logger: createMockLogger(),
      request: {},
      signal: controller.signal,
    };

    await createAttachProteusSourceMiddleware({ key: "proteus", source: source as any })(
      ctx,
      next,
    );

    ctx.proteus;

    expect(source.session).toHaveBeenCalledWith(
      expect.objectContaining({ signal: controller.signal }),
    );
  });

  test("should pass signal undefined for socket (non-HTTP) context", async () => {
    const source = createMockProteusSource();
    const ctx: any = { logger: createMockLogger(), event: "test:event" };

    await createAttachProteusSourceMiddleware({ key: "proteus", source: source as any })(
      ctx,
      next,
    );

    ctx.proteus;

    expect(source.session).toHaveBeenCalledWith(
      expect.objectContaining({ signal: undefined }),
    );
  });

  test("should resolve actor via the actor callback and forward it in hook meta", async () => {
    const source = createMockProteusSource();
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

    await createAttachProteusSourceMiddleware({
      key: "proteus",
      source: source as any,
      actor,
    })(ctx, next);

    ctx.proteus;

    expect(actor).toHaveBeenCalledWith(ctx);
    expect(source.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "corr-abc",
        actor: "alice@test.com",
        timestamp: new Date("2025-01-01T00:00:00Z"),
      },
      signal: undefined,
    });
  });

  test("should treat actor returning null/undefined as null in hook meta", async () => {
    const source = createMockProteusSource();
    const ctx: any = { logger: createMockLogger() };

    await createAttachProteusSourceMiddleware({
      key: "proteus",
      source: source as any,
      actor: () => null,
    })(ctx, next);

    ctx.proteus;

    expect(source.session).toHaveBeenCalledWith(
      expect.objectContaining({ meta: expect.objectContaining({ actor: null }) }),
    );
  });
});
