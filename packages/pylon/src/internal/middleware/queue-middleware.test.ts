import { createMockLogger } from "@lindorm/logger";
import { createQueueMiddleware } from "./queue-middleware";

describe("createQueueMiddleware", () => {
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
    const middleware = createQueueMiddleware();

    await middleware(ctx, jest.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("Queue is not enabled");
  });

  test("should throw when enabled:false", async () => {
    const middleware = createQueueMiddleware({ enabled: false });

    await middleware(ctx, jest.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("Queue is not enabled");
  });

  test("should publish job via iris when enabled", async () => {
    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

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

    await middleware(ctx, jest.fn());

    await ctx.queue("event", {}, "critical");

    expect(mockPublish).toHaveBeenCalledWith(expect.anything(), { priority: 10 });
  });

  test("should swallow error when optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

    await expect(ctx.queue("event", {}, "default", true)).resolves.toBeUndefined();
  });

  test("should throw error when not optional", async () => {
    mockPublish.mockRejectedValue(new Error("publish failed"));

    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, jest.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow("publish failed");
  });

  test("should use iris override source", async () => {
    const overrideWq = { create: mockCreate, publish: mockPublish };
    const overrideIris = {
      clone: jest
        .fn()
        .mockReturnValue({ workerQueue: jest.fn().mockReturnValue(overrideWq) }),
    };

    const middleware = createQueueMiddleware({
      enabled: true,
      iris: overrideIris as any,
    });

    await middleware(ctx, jest.fn());

    await ctx.queue("event", {});

    expect(overrideIris.clone).toHaveBeenCalledWith({ logger: ctx.logger });
  });

  test("should call next", async () => {
    const next = jest.fn();
    const middleware = createQueueMiddleware({ enabled: true });

    await middleware(ctx, next);

    expect(next).toHaveBeenCalled();
  });
});
