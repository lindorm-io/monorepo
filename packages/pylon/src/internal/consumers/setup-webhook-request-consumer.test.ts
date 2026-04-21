import {
  setupWebhookRequestConsumer,
  WEBHOOK_REQUEST_QUEUE,
} from "./setup-webhook-request-consumer.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

describe("setupWebhookRequestConsumer", () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockCreate = vi.fn().mockImplementation((data) => data);
  const mockFind = vi.fn().mockResolvedValue([]);
  const mockConsume = vi.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = vi.fn().mockReturnValue({
    consume: mockConsume,
    create: mockCreate,
    publish: mockPublish,
  });
  const mockRepository = vi.fn().mockReturnValue({ find: mockFind });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const proteus = { repository: mockRepository } as any;
  const logger = {
    debug: vi.fn(),
    verbose: vi.fn(),
  } as any;

  beforeEach(() => {
    vi.clearAllMocks();
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
        tenantId: null,
      },
      {
        id: "sub-2",
        event: "order.created",
        url: "https://example.com/hook2",
        suspendedAt: null,
        tenantId: null,
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "123" },
      tenantId: null,
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
      tenantId: null,
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
        tenantId: null,
      },
      {
        id: "sub-suspended",
        event: "order.created",
        url: "https://example.com/hook-suspended",
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
        tenantId: null,
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-3",
      event: "order.created",
      payload: { orderId: "999" },
      tenantId: null,
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
        tenantId: null,
      },
      {
        id: "sub-suspended-2",
        event: "order.created",
        url: "https://example.com/hook2",
        suspendedAt: new Date("2026-01-02T00:00:00.000Z"),
        tenantId: null,
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-4",
      event: "order.created",
      payload: {},
      tenantId: null,
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test("should only match null-tenant subscriptions when dispatch has null tenantId", async () => {
    const subscriptions = [
      {
        id: "sub-global",
        event: "order.created",
        url: "https://example.com/global",
        suspendedAt: null,
        tenantId: null,
      },
      {
        id: "sub-tenant-a",
        event: "order.created",
        url: "https://example.com/tenant-a",
        suspendedAt: null,
        tenantId: "tenant-a",
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-null",
      event: "order.created",
      payload: {},
      tenantId: null,
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-null",
      event: "order.created",
      payload: {},
      subscription: subscriptions[0],
    });
  });

  test("should match only tenanted subscriptions when all subs are tenanted", async () => {
    const subscriptions = [
      {
        id: "sub-tenant-a",
        event: "order.created",
        url: "https://example.com/tenant-a",
        suspendedAt: null,
        tenantId: "tenant-a",
      },
      {
        id: "sub-tenant-b",
        event: "order.created",
        url: "https://example.com/tenant-b",
        suspendedAt: null,
        tenantId: "tenant-b",
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-a",
      event: "order.created",
      payload: {},
      tenantId: "tenant-a",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-a",
      event: "order.created",
      payload: {},
      subscription: subscriptions[0],
    });
  });

  test("should match both global and tenanted subs for a tenanted dispatch", async () => {
    const subscriptions = [
      {
        id: "sub-global",
        event: "order.created",
        url: "https://example.com/global",
        suspendedAt: null,
        tenantId: null,
      },
      {
        id: "sub-tenant-a",
        event: "order.created",
        url: "https://example.com/tenant-a",
        suspendedAt: null,
        tenantId: "tenant-a",
      },
      {
        id: "sub-tenant-b",
        event: "order.created",
        url: "https://example.com/tenant-b",
        suspendedAt: null,
        tenantId: "tenant-b",
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-mixed",
      event: "order.created",
      payload: {},
      tenantId: "tenant-a",
    });

    expect(mockCreate).toHaveBeenCalledTimes(2);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-mixed",
      event: "order.created",
      payload: {},
      subscription: subscriptions[0],
    });
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-mixed",
      event: "order.created",
      payload: {},
      subscription: subscriptions[1],
    });
  });

  test("should isolate tenants - cross-tenant subscriptions not matched", async () => {
    const subscriptions = [
      {
        id: "sub-tenant-a",
        event: "order.created",
        url: "https://example.com/tenant-a",
        suspendedAt: null,
        tenantId: "tenant-a",
      },
      {
        id: "sub-tenant-b",
        event: "order.created",
        url: "https://example.com/tenant-b",
        suspendedAt: null,
        tenantId: "tenant-b",
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-c",
      event: "order.created",
      payload: {},
      tenantId: "tenant-c",
    });

    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockPublish).not.toHaveBeenCalled();
  });

  test("should respect suspended filter together with tenant match", async () => {
    const subscriptions = [
      {
        id: "sub-tenant-a-active",
        event: "order.created",
        url: "https://example.com/tenant-a-active",
        suspendedAt: null,
        tenantId: "tenant-a",
      },
      {
        id: "sub-tenant-a-suspended",
        event: "order.created",
        url: "https://example.com/tenant-a-suspended",
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
        tenantId: "tenant-a",
      },
      {
        id: "sub-global-suspended",
        event: "order.created",
        url: "https://example.com/global-suspended",
        suspendedAt: new Date("2026-01-01T00:00:00.000Z"),
        tenantId: null,
      },
    ];
    mockFind.mockResolvedValueOnce(subscriptions);

    await setupWebhookRequestConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-and",
      event: "order.created",
      payload: {},
      tenantId: "tenant-a",
    });

    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate).toHaveBeenCalledWith({
      correlationId: "corr-id-and",
      event: "order.created",
      payload: {},
      subscription: subscriptions[0],
    });
  });
});
