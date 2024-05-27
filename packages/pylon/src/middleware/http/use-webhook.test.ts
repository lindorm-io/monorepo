import { createMockLogger } from "@lindorm/logger";
import { WebhookHandler } from "../../types";
import { useWebhook } from "./use-webhook";

describe("useWebhook", () => {
  let ctx: any;

  beforeEach(() => {
    ctx = {
      logger: createMockLogger(),
      webhook: {
        event: "event",
        data: { foo: "bar" },
      },
    };
  });

  afterEach(jest.clearAllMocks);

  test("should call the webhook handler and await next before webhook is finished", async () => {
    const handler: WebhookHandler = async () => "OK";

    await expect(useWebhook(handler)(ctx, jest.fn())).resolves.toBeUndefined();
  });
});
