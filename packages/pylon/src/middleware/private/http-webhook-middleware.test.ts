import { createMockLogger } from "@lindorm/logger";
import { createHttpWebhookMiddleware } from "./http-webhook-middleware";

describe("createHttpWebhookMiddleware", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      state: {
        webhooks: [
          {
            event: "event",
            data: { foo: "bar" },
          },
        ],
      },
      metric: jest.fn().mockReturnValue({ end: jest.fn() }),
    };
  });

  afterEach(jest.clearAllMocks);

  test("should call the webhook handler and await next before webhook is finished", async () => {
    await expect(
      createHttpWebhookMiddleware(jest.fn())(ctx, jest.fn()),
    ).resolves.toBeUndefined();
  });
});
