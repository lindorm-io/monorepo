import { Aegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createHttpContextInitialisationMiddleware } from "./http-context-initialisation-middleware";

describe("createHttpContextInitialisationMiddleware", () => {
  let ctx: any;
  let options: any;
  let mockPublish: jest.Mock;
  let mockCreate: jest.Mock;

  beforeEach(() => {
    mockPublish = jest.fn();
    mockCreate = jest.fn().mockImplementation((data: any) => data);

    ctx = {
      state: {
        metadata: {
          correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
          id: "aa9a627d-8296-598c-9589-4ec91d27d056",
          responseId: "ee576e4a-c30c-5138-bfa8-51ca832bdaec",
        },
      },
      iris: {
        workerQueue: jest.fn().mockReturnValue({
          create: mockCreate,
          publish: mockPublish,
        }),
      },
      set: jest.fn(),
    };

    options = {
      amphora: createMockAmphora(),
      logger: createMockLogger(),
    };
  });

  test("should initialise context", async () => {
    await expect(
      createHttpContextInitialisationMiddleware(options)(ctx, jest.fn()),
    ).resolves.toBeUndefined();

    expect(ctx.body).toEqual({});
    expect(ctx.status).toEqual(404);

    expect(ctx.logger).toEqual(expect.any(Object));
    expect(ctx.amphora).toEqual(options.amphora);
    expect(ctx.aegis).toEqual(expect.any(Aegis));
    expect(ctx.conduits.conduit).toEqual(expect.any(Conduit));

    expect(ctx.queue).toEqual(expect.any(Function));
    expect(ctx.webhook).toEqual(expect.any(Function));
  });

  test("should publish queue job via iris", async () => {
    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await ctx.queue("event", { key: "value" });

    expect(mockCreate).toHaveBeenCalledWith({
      event: "event",
      payload: { key: "value" },
    });
    expect(mockPublish).toHaveBeenCalledWith(
      { event: "event", payload: { key: "value" } },
      { priority: 5 },
    );
  });

  test("should handle optional queue errors", async () => {
    mockPublish.mockRejectedValue(new Error("Queue error"));

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(
      ctx.queue("event", { key: "value" }, "high", true),
    ).resolves.not.toThrow();
  });

  test("should throw on queue error if not optional", async () => {
    mockPublish.mockRejectedValue(new Error("Queue error"));

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.queue("event", { key: "value" })).rejects.toThrow("Queue error");
  });

  test("should throw if iris not configured for queue", async () => {
    ctx.iris = undefined;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.queue("event", {})).rejects.toThrow(
      "IrisSource is not configured for queue",
    );
  });

  test("should publish webhook request via iris", async () => {
    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await ctx.webhook("event_name", { data: "test" });

    expect(mockCreate).toHaveBeenCalledWith({
      event: "event_name",
      payload: { data: "test" },
    });
    expect(mockPublish).toHaveBeenCalled();
  });

  test("should handle optional webhook errors", async () => {
    mockPublish.mockRejectedValue(new Error("Webhook error"));

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(
      ctx.webhook("event_name", { data: "test" }, true),
    ).resolves.not.toThrow();
  });

  test("should throw on webhook error if not optional", async () => {
    mockPublish.mockRejectedValue(new Error("Webhook error"));

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.webhook("event_name", { data: "test" })).rejects.toThrow(
      "Webhook error",
    );
  });

  test("should throw if iris not configured for webhook", async () => {
    ctx.iris = undefined;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.webhook("event_name")).rejects.toThrow(
      "IrisSource is not configured for webhook",
    );
  });
});
