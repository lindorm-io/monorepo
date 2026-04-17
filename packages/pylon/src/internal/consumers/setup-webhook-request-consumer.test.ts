import {
  setupWebhookRequestConsumer,
  WEBHOOK_REQUEST_QUEUE,
} from "./setup-webhook-request-consumer";

describe("setupWebhookRequestConsumer", () => {
  const mockPublish = jest.fn().mockResolvedValue(undefined);
  const mockCreate = jest.fn().mockImplementation((data) => data);
  const mockFind = jest.fn().mockResolvedValue([]);
  const mockConsume = jest.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = jest.fn().mockReturnValue({
    consume: mockConsume,
    create: mockCreate,
    publish: mockPublish,
  });
  const mockRepository = jest.fn().mockReturnValue({ find: mockFind });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const proteus = { repository: mockRepository } as any;
  const logger = {
    debug: jest.fn(),
    verbose: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("should set up worker queue consumer for WebhookRequest", async () => {
    await setupWebhookRequestConsumer(iris, proteus, logger);

    expect(mockWorkerQueue).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(WEBHOOK_REQUEST_QUEUE, expect.any(Function));
  });

  test("should publish WebhookDispatch for each matching subscription", async () => {
    const subscriptions = [
      {
        id: "sub-1",
        event: "order.created",
        url: "https://example.com/hook1",
        suspendedAt: null,
      },
      {
        id: "sub-2",
        event: "order.created",
        url: "https://example.com/hook2",
        suspendedAt: null,
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "123" },
    });

    expect(mockFind).toHaveBeenCalledWith({ event: "order.created" });
    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "123" },
      subscription: subscriptions[0],
    });
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "123" },
      subscription: subscriptions[1],
    });
    expect(mockPublish).toHaveBeenCalledTimes(2);
  });

  test("should not publish any dispatches when no subscriptions match", async () => {
    mockFind.mockResolvedValueOnce([]);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-2",
      event: "user.deleted",
      payload: {},
    });

    expect(mockFind).toHaveBeenCalledWith({ event: "user.deleted" });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test("should filter out suspended subscriptions before publishing", async () => {
    const subscriptions = [
      {
        id: "sub-active",
        event: "order.created",
        url: "https://example.com/hook-active",
        suspendedAt: null,
      },
      {
        id: "sub-suspended",
        event: "order.created",
        url: "https://example.com/hook-suspended",
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-3",
      event: "order.created",
      payload: { orderId: "999" },
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-3",
      event: "order.created",
      payload: { orderId: "999" },
      subscription: subscriptions[0],
    });
    expect(mockPublish).toHaveBeenCalledTimes(1);
  });

  test("should not publish any dispatches when all subscriptions are suspended", async () => {
    const subscriptions = [
      {
        id: "sub-suspended-1",
        event: "order.created",
        url: "https://example.com/hook1",
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
      },
      {
        id: "sub-suspended-2",
        event: "order.created",
        url: "https://example.com/hook2",
        suspendedAt: new Date("2026-01-02T00:00:00.000Z"),
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-4",
      event: "order.created",
      payload: {},
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });
});
