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

  // The bus message carries the id ONLY — never the subscription (and its
  // encrypted clientSecret). The consumer reloads DB-locally.
  const message = {
    correlationId: "corr-id-1",
    event: "order.created",
    payload: { orderId: "456" },
    subscriptionId: "sub-1",
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

  test("should create dispatch function with provided cache", async () => {
    const cache = [{ tokenUri: "https://auth.example.com/token" }] as any;

    await setupWebhookDispatchConsumer(iris, proteus, logger, { cache });

    expect(createDispatchWebhook).toHaveBeenCalledWith(logger, cache);
  });

  test("should reload the subscription by id and dispatch the DB-local copy", async () => {
    // The message carries no secret; the reloaded row (with a decrypted
    // clientSecret) is what dispatch authenticates with.
    const loaded = { ...baseSubscription, clientSecret: "decrypted-secret" };
    mockFindOne.mockResolvedValueOnce(loaded);

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];
    await handler(message);

    expect(mockFindOne).toHaveBeenCalledWith({ id: "sub-1" });
    expect(mockDispatchWebhook).toHaveBeenCalledWith({
      event: "order.created",
      payload: { orderId: "456" },
      subscription: loaded,
    });
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("should skip dispatch when the subscription is no longer present", async () => {
    mockFindOne.mockResolvedValueOnce(null);

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];
    await handler(message);

    expect(mockFindOne).toHaveBeenCalledWith({ id: "sub-1" });
    expect(mockDispatchWebhook).not.toHaveBeenCalled();
    expect(mockSave).not.toHaveBeenCalled();
  });

  test("should increment errorCount and set lastErrorAt on failure", async () => {
    mockFindOne.mockResolvedValueOnce({ ...baseSubscription, errorCount: 2 });
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];
    await handler(message);

    expect(mockFindOne).toHaveBeenCalledWith({ id: "sub-1" });
    expect(mockSave).toHaveBeenCalledTimes(1);
    const saved = mockSave.mock.calls[0][0];
    expect(saved.errorCount).toBe(3);
    expect(saved.lastErrorAt).toBeInstanceOf(Date);
    expect(saved.suspendedAt).toBeNull();
  });

  test("should suspend subscription when errorCount reaches default maxErrors", async () => {
    mockFindOne.mockResolvedValueOnce({ ...baseSubscription, errorCount: 9 });
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));

    await setupWebhookDispatchConsumer(iris, proteus, logger);

    const handler = mockConsume.mock.calls[0][1];
    await handler(message);

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
    mockFindOne.mockResolvedValueOnce({ ...baseSubscription, errorCount: 2 });
    mockDispatchWebhook.mockRejectedValueOnce(new Error("boom"));

    await setupWebhookDispatchConsumer(iris, proteus, logger, { maxErrors: 3 });

    const handler = mockConsume.mock.calls[0][1];
    await handler(message);

    const saved = mockSave.mock.calls[0][0];
    expect(saved.errorCount).toBe(3);
    expect(saved.suspendedAt).toBeInstanceOf(Date);
  });
});
