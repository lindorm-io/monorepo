import { createMockLogger } from "@lindorm/logger";
import { createWebhookMiddleware } from "./common-webhook-middleware";

describe("createWebhookMiddleware", () => {
  let ctx: any;
  let mockPublish: jest.Mock;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockPublish = jest.fn();
    mockCreate = jest.fn().mockImplementation((data: any) => data);

    ctx = {
      logger: createMockLogger(),
      iris: {
        workerQueue: jest.fn().mockReturnValue({
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
    const middleware = createWebhookMiddleware();

    await middleware(ctx, jest.fn());

    await expect(ctx.webhook("event")).rejects.toThrow("Webhook is not enabled");
  });

  test("should throw when enabled:false", async () => {
    const middleware = createWebhookMiddleware({ enabled: false });

    await middleware(ctx, jest.fn());

    await expect(ctx.webhook("event")).rejects.toThrow("Webhook is not enabled");
  });

  test("should publish webhook request via iris when enabled", async () => {
    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

    await ctx.webhook("test-event", { data: "test" });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "test-correlation-id",
      event: "test-event",
      payload: { data: "test" },
    });
    expect(mockPublish).toHaveBeenCalled();
  });

  test("should swallow error when optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

    await expect(ctx.webhook("event", {}, true)).resolves.toBeUndefined();
  });

  test("should throw error when not optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

    await expect(ctx.webhook("event", {})).rejects.toThrow("publish failed");
  });

  test("should use iris override source", async () => {
    const overrideWq = { create: mockCreate, publish: mockPublish };
    const overrideIris = {
      clone: jest
        .fn()
        .mockReturnValue({ workerQueue: jest.fn().mockReturnValue(overrideWq) }),
    };

    const middleware = createWebhookMiddleware({
      enabled: true,
      iris: overrideIris as any,
    });

    await middleware(ctx, jest.fn());

    await ctx.webhook("event", {});

    expect(overrideIris.clone).toHaveBeenCalledWith({ logger: ctx.logger, context: ctx });
  });

  test("should call next", async () => {
    const next = jest.fn();
    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
