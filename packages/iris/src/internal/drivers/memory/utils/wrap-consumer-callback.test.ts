import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope } from "../../../../types";
import type { MessageMetadata } from "../../../message/types/metadata";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store";
import { createStore } from "./create-store";
import {
  wrapConsumerCallback,
  type ConsumerCallbackHost,
} from "./wrap-consumer-callback";
import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockHost = <M extends IMessage>(): ConsumerCallbackHost<M> => ({
  prepareForConsume: vi.fn().mockResolvedValue({ data: "hydrated" }),
  afterConsumeSuccess: vi.fn().mockResolvedValue(undefined),
  onConsumeError: vi.fn().mockResolvedValue(undefined),
});

const createMockDeadLetterManager = (): DeadLetterManager =>
  ({
    send: vi.fn().mockResolvedValue("dl-id"),
    list: vi.fn().mockResolvedValue([]),
    get: vi.fn().mockResolvedValue(null),
    remove: vi.fn().mockResolvedValue(false),
    purge: vi.fn().mockResolvedValue(0),
    count: vi.fn().mockResolvedValue(0),
    close: vi.fn().mockResolvedValue(undefined),
  }) as any;

const createEnvelope = (overrides: Partial<MemoryEnvelope> = {}): MemoryEnvelope => ({
  payload: Buffer.from("test"),
  headers: {},
  topic: "test-topic",
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant" as const,
  retryDelay: 100,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
  ...overrides,
});

const createMetadata = (overrides: Partial<MessageMetadata> = {}): MessageMetadata =>
  ({
    deadLetter: false,
    namespace: null,
    version: 1,
    message: { name: "TestMessage" },
    ...overrides,
  }) as unknown as MessageMetadata;

describe("wrapConsumerCallback", () => {
  describe("happy path", () => {
    it("should call prepareForConsume, callback, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope();
      await wrapped(envelope);

      expect(host.prepareForConsume).toHaveBeenCalledWith(
        envelope.payload,
        envelope.headers,
      );
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({
          topic: envelope.topic,
          headers: envelope.headers,
          attempt: envelope.attempt,
          correlationId: envelope.correlationId,
          timestamp: envelope.timestamp,
        }),
      );
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
    });

    it("should pass ConsumeEnvelope with metadata fields to callback", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const store = createStore();
      const metadata = createMetadata({
        namespace: "my-namespace",
        version: 3,
      } as Partial<MessageMetadata>);
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope({
        topic: "orders.created",
        headers: { "x-trace": "abc123" },
        attempt: 2,
        correlationId: "corr-456",
        timestamp: 1700000000000,
      });
      await wrapped(envelope);

      const consumeEnvelope: ConsumeEnvelope = callback.mock.calls[0][1];
      expect(consumeEnvelope).toMatchSnapshot();
    });
  });

  describe("expiry", () => {
    it("should skip expired envelopes", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope({
        timestamp: Date.now() - 10_000,
        expiry: 1000,
      });
      await wrapped(envelope);

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping expired message",
        expect.any(Object),
      );
    });
  });

  describe("error handling", () => {
    it("should call onConsumeError when callback throws", async () => {
      const host = createMockHost();
      const error = new Error("callback failed");
      const callback = vi.fn().mockRejectedValue(error);
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope());

      expect(host.onConsumeError).toHaveBeenCalledWith(error, { data: "hydrated" });
    });

    it("should wrap non-Error throws into Error instances", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue("string error");
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope());

      expect(host.onConsumeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" }),
        { data: "hydrated" },
      );
    });

    it("should not call onConsumeError if prepareForConsume fails", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("hydration failed"));
      const callback = vi.fn();
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope());

      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
    });

    it("should send to dead letter on prepareForConsume failure when enabled", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("hydration failed"));
      const callback = vi.fn();
      const store = createStore();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
        { deadLetterManager },
      );

      await wrapped(createEnvelope());

      expect(deadLetterManager.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "hydration failed" }),
      );
    });

    it("should not send to dead letter on prepareForConsume failure when no manager", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("hydration failed"));
      const callback = vi.fn();
      const store = createStore();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope());

      // No crash, just logs the error
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
    });

    it("should not retry on prepareForConsume failure even with retries remaining", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("hydration failed"));
      const callback = vi.fn();
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope({ maxRetries: 5 }));

      expect(callback).not.toHaveBeenCalled();
    });

    it("should log and swallow afterConsumeSuccess errors without retry", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as Mock).mockRejectedValue(new Error("hook failed"));
      const callback = vi.fn().mockResolvedValue(undefined);
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      await wrapped(createEnvelope({ maxRetries: 5 }));

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
      expect(host.onConsumeError).not.toHaveBeenCalled();
    });
  });

  describe("retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should schedule retry when attempt < maxRetries", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope({ maxRetries: 2, retryDelay: 100 });
      await wrapped(envelope);

      expect(callback).toHaveBeenCalledTimes(1);

      // Advance timer to trigger retry
      await vi.advanceTimersByTimeAsync(100);

      expect(callback).toHaveBeenCalledTimes(2);

      // Verify the retry envelope has an incremented attempt
      // callback receives (message, consumeEnvelope) — attempt is on the 2nd arg
      const retryConsumeEnvelope = callback.mock.calls[1][1];
      expect(retryConsumeEnvelope.attempt).toBe(1);
    });

    it("should not retry when attempt >= maxRetries", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const store = createStore();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope({ attempt: 2, maxRetries: 2 });
      await wrapped(envelope);

      // No retry scheduled — just the initial call
      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("dead letter", () => {
    it("should send to dead letter when retries exhausted and dead letter enabled", async () => {
      const host = createMockHost();
      const error = new Error("permanent failure");
      const callback = vi.fn().mockRejectedValue(error);
      const store = createStore();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
        { deadLetterManager },
      );

      const envelope = createEnvelope({ attempt: 3, maxRetries: 3 });
      await wrapped(envelope);

      expect(deadLetterManager.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "permanent failure" }),
      );
    });

    it("should not send to dead letter when dead letter is false", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const store = createStore();
      const metadata = createMetadata({ deadLetter: false });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
        { deadLetterManager },
      );

      const envelope = createEnvelope({ attempt: 3, maxRetries: 3 });
      await wrapped(envelope);

      expect(deadLetterManager.send).not.toHaveBeenCalled();
    });

    it("should not crash when dead letter enabled but no manager provided", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const store = createStore();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapConsumerCallback(
        host,
        callback,
        store,
        metadata,
        logger as any,
      );

      const envelope = createEnvelope({ attempt: 3, maxRetries: 3 });
      await expect(wrapped(envelope)).resolves.toBeUndefined();
    });
  });
});
