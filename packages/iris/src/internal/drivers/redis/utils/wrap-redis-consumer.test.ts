import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope } from "../../../../types";
import type { MessageMetadata } from "../../../message/types/metadata";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { RedisSharedState, RedisStreamEntry } from "../types/redis-types";
import { wrapRedisConsumer, type RedisConsumerCallbackHost } from "./wrap-redis-consumer";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockHost = <M extends IMessage>(): RedisConsumerCallbackHost<M> => ({
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

const createMockConnection = () => ({
  xadd: vi.fn().mockResolvedValue("1-0"),
  xreadgroup: vi.fn().mockResolvedValue(null),
  xack: vi.fn().mockResolvedValue(1),
  xgroup: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
  duplicate: vi.fn(),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
});

const createEntry = (overrides: Partial<RedisStreamEntry> = {}): RedisStreamEntry => ({
  id: "1700000000000-0",
  payload: Buffer.from('{"data":"test"}'),
  headers: {},
  topic: "test-topic",
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 0,
  retryStrategy: "constant",
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
    broadcast: false,
    retry: null,
    expiry: null,
    namespace: null,
    version: 1,
    message: { name: "TestMessage" },
    ...overrides,
  }) as unknown as MessageMetadata;

const createState = (overrides?: Partial<RedisSharedState>): RedisSharedState => ({
  publishConnection: createMockConnection() as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:localhost:1234:abcdef01",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 2000,
  maxStreamLength: null,
  ...overrides,
});

describe("wrapRedisConsumer", () => {
  describe("happy path", () => {
    it("should call prepareForConsume, callback, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      const entry = createEntry();
      await wrapped(entry);

      expect(host.prepareForConsume).toHaveBeenCalledWith(entry.payload, entry.headers);
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({
          topic: entry.topic,
          headers: entry.headers,
          attempt: entry.attempt,
          correlationId: entry.correlationId,
          timestamp: entry.timestamp,
        }),
      );
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
    });

    it("should pass ConsumeEnvelope with metadata fields to callback", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata({ namespace: "my-ns", version: 3 });
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      const entry = createEntry({
        topic: "orders.created",
        headers: { "x-trace": "abc" },
        attempt: 2,
        correlationId: "corr-1",
        timestamp: 1700000000000,
      });
      await wrapped(entry);

      const consumeEnvelope: ConsumeEnvelope = callback.mock.calls[0][1];
      expect(consumeEnvelope).toMatchSnapshot();
    });

    it("should decrement inFlightCount after processing", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());
      expect(state.inFlightCount).toBe(0);
    });

    it("should increment inFlightCount during processing", async () => {
      const host = createMockHost();
      let captured = -1;
      const callback = vi.fn().mockImplementation(async () => {
        captured = state.inFlightCount;
      });
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());
      expect(captured).toBe(1);
      expect(state.inFlightCount).toBe(0);
    });
  });

  describe("expiry", () => {
    it("should skip expired messages", async () => {
      const host = createMockHost();
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const entry = createEntry({
        timestamp: Date.now() - 10_000,
        expiry: 1000,
      });
      await wrapped(entry);

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping expired message",
        expect.any(Object),
      );
    });

    it("should not skip messages with null expiry", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const entry = createEntry({ expiry: null });
      await wrapped(entry);

      expect(callback).toHaveBeenCalledTimes(1);
    });
  });

  describe("deserialization failure", () => {
    it("should log and send to dead letter on deserialization error", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      await wrapped(createEntry());

      expect(callback).not.toHaveBeenCalled();
      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
      expect(deadLetterManager.send).toHaveBeenCalled();
    });

    it("should wrap non-Error deserialization failures", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue("string error");
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());

      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.objectContaining({
          error: expect.objectContaining({ message: "string error" }),
        }),
      );
    });

    it("should not send to dead letter when no manager provided", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      await wrapped(createEntry());

      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
    });
  });

  describe("callback error - retry", () => {
    it("should republish with incremented attempt when retries remain (no delayManager)", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      const entry = createEntry({ maxRetries: 3, retryDelay: 100 });
      await wrapped(entry);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(state.publishConnection!.xadd).toHaveBeenCalledTimes(1);

      const xaddArgs = (state.publishConnection!.xadd as Mock).mock.calls[0];
      // Should contain "attempt" followed by "1"
      const attemptIndex = xaddArgs.indexOf("attempt");
      expect(attemptIndex).toBeGreaterThan(-1);
      expect(xaddArgs[attemptIndex + 1]).toBe("1");
    });

    it("should schedule retry via delayManager when available", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();
      const delayManager = { schedule: vi.fn().mockResolvedValue("delay-id") } as any;

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        delayManager,
      });

      const entry = createEntry({ maxRetries: 3, retryDelay: 100 });
      await wrapped(entry);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(delayManager.schedule).toHaveBeenCalledTimes(1);
      expect(delayManager.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, topic: "test-topic" }),
        "test-topic",
        expect.any(Number),
      );
      // Should NOT have called xadd directly
      expect(state.publishConnection!.xadd).not.toHaveBeenCalled();
    });

    it("should not retry when attempt >= maxRetries", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      const entry = createEntry({ attempt: 3, maxRetries: 3 });
      await wrapped(entry);

      expect(state.publishConnection!.xadd).not.toHaveBeenCalled();
    });
  });

  describe("callback error - exhausted retries", () => {
    it("should send to dead letter when retries exhausted and dead letter enabled", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("permanent"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      const entry = createEntry({ attempt: 3, maxRetries: 3 });
      await wrapped(entry);

      expect(deadLetterManager.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "permanent" }),
      );
    });

    it("should not send to dead letter when dead letter is disabled", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: false });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      const entry = createEntry({ attempt: 3, maxRetries: 3 });
      await wrapped(entry);

      expect(deadLetterManager.send).not.toHaveBeenCalled();
    });

    it("should send to dead letter when no retries configured and dead letter enabled", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      await wrapped(createEntry());

      expect(deadLetterManager.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "fail" }),
      );
    });

    it("should not crash when dead letter enabled but no manager provided", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any);

      const entry = createEntry({ attempt: 3, maxRetries: 3 });
      await expect(wrapped(entry)).resolves.toBeUndefined();
    });
  });

  describe("afterConsumeSuccess hook", () => {
    it("should log and swallow afterConsumeSuccess errors", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as Mock).mockRejectedValue(new Error("hook failed"));
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
    });
  });

  describe("error wrapping", () => {
    it("should wrap non-Error callback throws into Error instances", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue("string error");
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapRedisConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      await wrapped(createEntry());

      expect(host.onConsumeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" }),
        { data: "hydrated" },
      );
    });
  });

  describe("inFlightCount management", () => {
    it("should decrement inFlightCount even on error", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());
      expect(state.inFlightCount).toBe(0);
    });

    it("should decrement inFlightCount on deserialization failure", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRedisConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createEntry());
      expect(state.inFlightCount).toBe(0);
    });
  });
});
