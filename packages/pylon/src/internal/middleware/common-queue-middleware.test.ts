import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createQueueMiddleware } from "./common-queue-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createQueueMiddleware", () => {
  let ctx: any;
  let mockPublish: Mock;
  let mockCreate: Mock;

  beforeEach(() => {
    mockPublish = vi.fn();
    mockCreate = vi.fn().mockImplementation((data: any) => data);

    ctx = {
      logger: createMockLogger(),
      iris: {
        workerQueue: vi.fn().mockReturnValue({
          create: mockCreate,
          publish: mockPublish,
        }),
      },
      state: {
        metadata: {
          correlationId: "test-correlation-id",
        },
      },
    };
  });

  test("should throw when not enabled", async () => {
    const middleware = createQueueMiddleware();

    await middleware(ctx, vi.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("Queue is not enabled");
  });

  test("should throw when enabled:false", async () => {
    const middleware = createQueueMiddleware({ enabled: false });

    await middleware(ctx, vi.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("Queue is not enabled");
  });

  test("should publish job via iris when enabled", async () => {
    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await ctx.queue("test-event", { key: "value" });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "test-correlation-id",
      event: "test-event",
      payload: { key: "value" },
    });
    expect(mockPublish).toHaveBeenCalledWith(
      expect.objectContaining({ event: "test-event" }),
      { priority: 5 },
    );
  });

  test("should map priority to numeric value", async () => {
    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await ctx.queue("event", {}, "critical");

    expect(mockPublish).toHaveBeenCalledWith(expect.anything(), { priority: 10 });
  });

  test("should swallow error when optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await expect(ctx.queue("event", {}, "default", true)).resolves.toBeUndefined();
  });

  test("should throw error when not optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("publish failed");
  });

  test("should use iris override source", async () => {
    const overrideWq = { create: mockCreate, publish: mockPublish };
    const overrideIris = {
      session: vi
        .fn()
        .mockReturnValue({ workerQueue: vi.fn().mockReturnValue(overrideWq) }),
    };

    const middleware = createQueueMiddleware({
      enabled: true,
      iris: overrideIris as any,
    });

    await middleware(ctx, vi.fn());

    await ctx.queue("event", {});

    expect(overrideIris.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      context: ctx,
    });
  });

  test("should call next", async () => {
    const next = vi.fn();
    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
