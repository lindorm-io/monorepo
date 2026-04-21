import {
  setupWebhookDispatchConsumer,
  WEBHOOK_DISPATCH_QUEUE,
} from "./setup-webhook-dispatch-consumer.js";
import { beforeEach, describe, expect, test, vi, type Mock } from "vitest";

vi.mock("../utils/dispatch-webhook.js");

import { createDispatchWebhook } from "../utils/dispatch-webhook.js";

describe("setupWebhookDispatchConsumer", async () => {
  const mockDispatchWebhook = vi.fn().mockResolvedValue(undefined);
  (createDispatchWebhook as Mock).mockReturnValue(mockDispatchWebhook);

  const mockConsume = vi.fn().mockResolvedValue(undefined);
  const mockWorkerQueue = vi.fn().mockReturnValue({ consume: mockConsume });

  const mockFindOne = vi.fn();
  const mockSave = vi.fn().mockResolvedValue(undefined);
  const mockRepository = vi
    .fn()
    .mockReturnValue({ findOne: mockFindOne, save: mockSave });

  const iris = { workerQueue: mockWorkerQueue } as any;
  const proteus = { repository: mockRepository } as any;
  const logger = {
    debug: vi.fn(),
    error: vi.fn(),
    verbose: vi.fn(),
    warn: vi.fn(),
  } as any;

  const baseSubscription = {
    id: "sub-1",
    event: "order.created",
    url: "https://example.com/hook",
    auth: "none",
    errorCount: 0,
    lastErrorAt: null,
    suspendedAt: null,
  };

  beforeEach(() => {
    vi.clearAllMocks();
    (createDispatchWebhook as Mock).mockReturnValue(mockDispatchWebhook);
  });

  test("should set up worker queue consumer for WebhookDispatch", async () => {
    await setupWebhookDispatchConsumer(iris, proteus, logger);

    expect(mockWorkerQueue).toHaveBeenCalledTimes(1);
    expect(mockConsume).toHaveBeenCalledWith(
      WEBHOOK_DISPATCH_QUEUE,
      expect.any(Function),
    );
  });

  test("should create dispatch function with provided options", async () => {
    const encryptionKey = { type: "oct" } as any;
    const cache = [{ tokenUri: "https://auth.example.com/token" }] as any;

    await setupWebhookDispatchConsumer(iris, proteus, logger, {
      encryptionKey,
      cache,
    });

    expect(createDispatchWebhook).toHaveBeenCalledWith({ encryptionKey }, logger, cache);
  });

  test("should call dispatchWebhook with message data when consumed", async () => {
    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-1",
      event: "order.created",
      payload: { orderId: "456" },
      subscription: baseSubscription,
    });

    expect(mockDispatchWebhook).toHaveBeenCalledWith({
      event: "order.created",
      payload: { orderId: "456" },
      subscription: baseSubscription,
    });
  });

  test("should not touch the repository on successful dispatch", async () => {
    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-ok",
      event: "order.created",
      payload: {},
      subscription: baseSubscription,
    });

    expect(mockRepository).not.toHaveBeenCalled();
    expect(mockFindOne).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("should increment errorCount and set lastErrorAt on failure", async () => {
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));
    const loaded = { ...baseSubscription, errorCount: 2 };
    mockFindOne.mockResolvedValueOnce(loaded);

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-fail",
      event: "order.created",
      payload: {},
      subscription: baseSubscription,
    });

    expect(mockFindOne).toHaveBeenCalledWith({ id: "sub-1" });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const saved = mockSave.mock.calls[0][0];
    expect(saved.errorCount).toBe(3);
    expect(saved.lastErrorAt).toBeInstanceOf(Date);
    expect(saved.suspendedAt).toBeNull();
  });

  test("should suspend subscription when errorCount reaches default maxErrors", async () => {
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));
    const loaded = { ...baseSubscription, errorCount: 9 };
    mockFindOne.mockResolvedValueOnce(loaded);

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-suspend",
      event: "order.created",
      payload: {},
      subscription: baseSubscription,
    });

    expect(mockSave).toHaveBeenCalledTimes(1);
    const saved = mockSave.mock.calls[0][0];
    expect(saved.errorCount).toBe(10);
    expect(saved.lastErrorAt).toBeInstanceOf(Date);
    expect(saved.suspendedAt).toBeInstanceOf(Date);
    expect(logger.warn).toHaveBeenCalledWith(
      "Webhook subscription suspended",
      expect.objectContaining({
        subscriptionId: "sub-1",
        errorCount: 10,
        maxErrors: 10,
      }),
    );
  });

  test("should honour custom maxErrors option", async () => {
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));
    const loaded = { ...baseSubscription, errorCount: 2 };
    mockFindOne.mockResolvedValueOnce(loaded);

    await setupWebhookDispatchConsumer(iris, proteus, logger, { maxErrors: 3 });

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-custom",
      event: "order.created",
      payload: {},
      subscription: baseSubscription,
    });

    const saved = mockSave.mock.calls[0][0];
    expect(saved.errorCount).toBe(3);
    expect(saved.suspendedAt).toBeInstanceOf(Date);
  });

  test("should not save when subscription is no longer present", async () => {
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));
    mockFindOne.mockResolvedValueOnce(null);

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];

    await handler({
      correlationId: "corr-id-missing",
      event: "order.created",
      payload: {},
      subscription: baseSubscription,
    });

    expect(mockFindOne).toHaveBeenCalledWith({ id: "sub-1" });
    expect(mockSave).not.toHaveBeenCalled();
  });
});
