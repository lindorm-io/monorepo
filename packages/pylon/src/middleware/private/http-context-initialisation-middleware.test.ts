import { Aegis } from "@lindorm/aegis";
import { createMockAmphora } from "@lindorm/amphora";
import { Conduit } from "@lindorm/conduit";
import { createMockLogger } from "@lindorm/logger";
import { createHttpContextInitialisationMiddleware } from "./http-context-initialisation-middleware";

describe("createHttpContextInitialisationMiddleware", () => {
  let ctx: any;
  let options: any;

  beforeEach(() => {
    ctx = {
      state: {
        metadata: {
          correlationId: "8b39eafc-7e31-501b-ab7b-58514b14856a",
          requestId: "aa9a627d-8296-598c-9589-4ec91d27d056",
          responseId: "ee576e4a-c30c-5138-bfa8-51ca832bdaec",
        },
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

    expect(ctx.metric).toEqual(expect.any(Function));
    expect(ctx.queue).toEqual(expect.any(Function));
    expect(ctx.webhook).toEqual(expect.any(Function));
  });

  test("should handle queues", async () => {
    const queueHandler = jest.fn();

    options.queue = queueHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await ctx.queue({ key: "value" });

    expect(queueHandler).toHaveBeenCalledWith(
      expect.any(Object),
      { key: "value" },
      "urn:lindorm:priority:default",
    );
  });

  test("should handle optional queues", async () => {
    const queueHandler = jest.fn().mockRejectedValue(new Error("Queue error"));

    options.queue = queueHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.queue({ key: "value" }, "high", true)).resolves.not.toThrow();
  });

  test("should throw on queue error if not optional", async () => {
    const queueHandler = jest.fn().mockRejectedValue(new Error("Queue error"));

    options.queue = queueHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.queue({ key: "value" })).rejects.toThrow("Queue error");
  });

  test("should handle webhooks", async () => {
    const webhookHandler = jest.fn();

    options.webhook = webhookHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await ctx.webhook("event_name", { data: "test" });

    expect(webhookHandler).toHaveBeenCalledWith(expect.any(Object), "event_name", {
      data: "test",
    });
  });

  test("should handle optional webhooks", async () => {
    const webhookHandler = jest.fn().mockRejectedValue(new Error("Webhook error"));

    options.webhook = webhookHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(
      ctx.webhook("event_name", { data: "test" }, true),
    ).resolves.not.toThrow();
  });

  test("should throw on webhook error if not optional", async () => {
    const webhookHandler = jest.fn().mockRejectedValue(new Error("Webhook error"));

    options.webhook = webhookHandler;

    await createHttpContextInitialisationMiddleware(options)(ctx, jest.fn());

    await expect(ctx.webhook("event_name", { data: "test" })).rejects.toThrow(
      "Webhook error",
    );
  });
});
