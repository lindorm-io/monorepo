import {
  setupWebhookDispatchConsumer,
  WEBHOOK_DISPATCH_QUEUE,
} from "./setup-webhook-dispatch-consumer";

jest.mock("../utils/dispatch-webhook");

import { createDispatchWebhook } from "../utils/dispatch-webhook";

describe("setupWebhookDispatchConsumer", () => {
  const mockDispatchWebhook = jest.fn().mockResolvedValue(undefined);
  (createDispatchWebhook as jest.Mock).mockReturnValue(mockDispatchWebhook);

  const mockConsume = jest.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = jest.fn().mockReturnValue({ consume: mockConsume });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const logger = {
    debug: jest.fn(),
    verbose: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    (createDispatchWebhook as jest.Mock).mockReturnValue(mockDispatchWebhook);
  });

  test("should set up worker queue consumer for WebhookDispatch", async () => {
    await setupWebhookDispatchConsumer(iris, logger);

    expect(mockWorkerQueue).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(
      WEBHOOK_DISPATCH_QUEUE,
      expect.any(Function),
    );
  });

  test("should create dispatch function with provided options", async () => {
    const encryptionKey = { type: "oct" } as any;
    const cache = [{ tokenUri: "https://auth.example.com/token" }] as any;

    await setupWebhookDispatchConsumer(iris, logger, { encryptionKey, cache });

    expect(createDispatchWebhook).toHaveBeenCalledWith({ encryptionKey }, logger, cache);
  });

  test("should call dispatchWebhook with message data when consumed", async () => {
    await setupWebhookDispatchConsumer(iris, logger);

    const handler = mockConsume.mock.calls[0][1];

    const subscription = {
      id: "sub-1",
      event: "order.created",
      url: "https://example.com/hook",
      auth: "none",
    };

    await handler({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "456" },
      subscription,
    });

    expect(mockDispatchWebhook).toHaveBeenCalledWith({
      event: "order.created",
      payload: { orderId: "456" },
      subscription,
    });
  });
});
