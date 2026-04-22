import { createMockLogger } from "@lindorm/logger/mocks/vitest";
import { createWebhookMiddleware } from "./common-webhook-middleware.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

describe("createWebhookMiddleware", () => {
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
    const middleware = createWebhookMiddleware();

    await middleware(ctx, vi.fn());

    await expect(ctx.webhook("event")).rejects.toThrow("Webhook is not enabled");
  });

  test("should throw when enabled:false", async () => {
    const middleware = createWebhookMiddleware({ enabled: false });

    await middleware(ctx, vi.fn());

    await expect(ctx.webhook("event")).rejects.toThrow("Webhook is not enabled");
  });

  test("should publish webhook request via iris when enabled", async () => {
    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await ctx.webhook("test-event", { data: "test" });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "test-correlation-id",
      event: "test-event",
      payload: { data: "test" },
      tenantId: null,
    });
    expect(mockPublish).toHaveBeenCalled();
  });

  test("should propagate tenantId from ctx.state.tenant", async () => {
    ctx.state.tenant = "tenant-xyz";

    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await ctx.webhook("tenant-event", { foo: "bar" });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "test-correlation-id",
      event: "tenant-event",
      payload: { foo: "bar" },
      tenantId: "tenant-xyz",
    });
  });

  test("should coerce undefined tenant to null", async () => {
    // ctx.state.tenant intentionally not set (useTenant() never ran)
    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await ctx.webhook("missing-tenant-event", { foo: "bar" });

    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "test-correlation-id",
      event: "missing-tenant-event",
      payload: { foo: "bar" },
      tenantId: null,
    });
  });

  test("should swallow error when optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await expect(ctx.webhook("event", {}, true)).resolves.toBeUndefined();
  });

  test("should throw error when not optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, vi.fn());

    await expect(ctx.webhook("event", {})).rejects.toThrow("publish failed");
  });

  test("should use iris override source", async () => {
    const overrideWq = { create: mockCreate, publish: mockPublish };
    const overrideIris = {
      session: vi
        .fn()
        .mockReturnValue({ workerQueue: vi.fn().mockReturnValue(overrideWq) }),
    };

    const middleware = createWebhookMiddleware({
      enabled: true,
      iris: overrideIris as any,
    });

    await middleware(ctx, vi.fn());

    await ctx.webhook("event", {});

    expect(overrideIris.session).toHaveBeenCalledWith({
      logger: ctx.logger,
      meta: {
        correlationId: "test-correlation-id",
        actor: null,
        timestamp: expect.any(Date),
      },
    });
  });

  test("should call next", async () => {
    const next = vi.fn();
    const middleware = createWebhookMiddleware({ enabled: true });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
