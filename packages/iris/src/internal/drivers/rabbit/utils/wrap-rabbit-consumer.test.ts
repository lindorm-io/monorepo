import type { ConsumeMessage } from "amqplib";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import {
  wrapRabbitConsumer,
  type RabbitConsumerCallbackHost,
} from "./wrap-rabbit-consumer.js";
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

const createMockHost = <M extends IMessage>(): RabbitConsumerCallbackHost<M> => ({
  prepareForConsume: vi.fn().mockResolvedValue({ data: "hydrated" }),
  afterConsumeSuccess: vi.fn().mockResolvedValue(undefined),
  onConsumeError: vi.fn().mockResolvedValue(undefined),
});

const createMockChannel = () => ({
  ack: vi.fn(),
  nack: vi.fn(),
});

const createMockPublishChannel = () => ({
  publish: vi.fn(
    (
      _exchange: string,
      _routingKey: string,
      _content: Buffer,
      _options: any,
      callback: any,
    ) => {
      process.nextTick(() => callback(null));
      return true;
    },
  ),
  assertQueue: vi
    .fn()
    .mockResolvedValue({ queue: "test", messageCount: 0, consumerCount: 0 }),
});

const createConsumeMessage = (overrides?: {
  content?: Buffer;
  headers?: Record<string, unknown>;
  routingKey?: string;
  timestamp?: number;
  priority?: number;
}): ConsumeMessage =>
  ({
    content: overrides?.content ?? Buffer.from('{"data":"test"}'),
    fields: {
      deliveryTag: 1,
      redelivered: false,
      exchange: "iris",
      routingKey: overrides?.routingKey ?? "test-topic",
      consumerTag: "ctag-1",
    },
    properties: {
      headers: overrides?.headers ?? {},
      timestamp: overrides?.timestamp ?? 1700000000000,
      priority: overrides?.priority ?? 0,
      contentType: undefined,
      contentEncoding: undefined,
      correlationId: undefined,
      replyTo: undefined,
      expiration: undefined,
      messageId: undefined,
      type: undefined,
      userId: undefined,
      appId: undefined,
      clusterId: undefined,
      deliveryMode: undefined,
    },
  }) as unknown as ConsumeMessage;

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

const createState = (overrides?: Partial<RabbitSharedState>): RabbitSharedState => {
  const consumeChannel = createMockChannel();
  const publishChannel = createMockPublishChannel();
  return {
    connection: null,
    publishChannel: publishChannel as any,
    consumeChannel: consumeChannel as any,
    exchange: "iris",
    dlxExchange: "iris.dlx",
    dlqQueue: "iris.dlq",
    consumerRegistrations: [],
    assertedQueues: new Set(),
    assertedDelayQueues: new Set(),
    replyConsumerTags: [],
    reconnecting: false,
    prefetch: 10,
    inFlightCount: 0,
    ...overrides,
  };
};

describe("wrapRabbitConsumer", () => {
  describe("null message guard", () => {
    it("should return early when msg is null", async () => {
      const host = createMockHost();
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(null);

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
    });

    it("should return early when consume channel is null", async () => {
      const host = createMockHost();
      const callback = vi.fn();
      const state = createState({ consumeChannel: null });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createConsumeMessage());

      expect(host.prepareForConsume).not.toHaveBeenCalled();
    });
  });

  describe("happy path", () => {
    it("should call prepareForConsume, callback, ack, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createConsumeMessage();
      await wrapped(msg);

      expect(host.prepareForConsume).toHaveBeenCalledWith(
        msg.content,
        expect.any(Object),
      );
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({ topic: "test-topic" }),
      );
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
    });

    it("should pass ConsumeEnvelope with metadata fields to callback", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata({ namespace: "my-ns", version: 3 });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        routingKey: "orders.created",
        headers: { "x-iris-attempt": "2", "x-iris-correlation-id": "corr-1" },
        timestamp: 1700000000000,
      });
      await wrapped(msg);

      const consumeEnvelope: ConsumeEnvelope = callback.mock.calls[0][1];
      expect(consumeEnvelope).toMatchSnapshot();
    });
  });

  describe("expiry", () => {
    it("should ack and skip expired messages", async () => {
      const host = createMockHost();
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createConsumeMessage({
        timestamp: Date.now() - 10_000,
        headers: { "x-iris-expiry": "1000" },
      });
      await wrapped(msg);

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping expired message",
        expect.any(Object),
      );
    });
  });

  describe("deserialization failure", () => {
    it("should ack and discard on deserialization error when deadLetter is false", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createConsumeMessage();
      await wrapped(msg);

      expect(callback).not.toHaveBeenCalled();
      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization error, discarding message (no dead letter configured)",
        expect.any(Object),
      );
    });

    it("should nack to DLX on deserialization error when deadLetter is true", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata({ deadLetter: true }),
        logger as any,
      );

      const msg = createConsumeMessage();
      await wrapped(msg);

      expect(callback).not.toHaveBeenCalled();
      expect(state.consumeChannel!.nack).toHaveBeenCalledWith(msg, false, false);
    });

    it("should ack and discard non-Error deserialization failures when deadLetter is false", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue("string error");
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createConsumeMessage());

      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(expect.anything());
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
    });
  });

  describe("callback error - retry", () => {
    it("should retry via ack-last when attempts remain", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const logger = createMockLogger();

      const metadata = createMetadata({
        retry: {
          maxRetries: 3,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: {
          "x-iris-attempt": "0",
        },
      });
      await wrapped(msg);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(state.publishChannel!.assertQueue).toHaveBeenCalledWith(
        "iris.delay.test-topic",
        expect.objectContaining({
          durable: true,
          deadLetterExchange: "iris",
          deadLetterRoutingKey: "test-topic",
        }),
      );
      expect(state.publishChannel!.publish).toHaveBeenCalledWith(
        "",
        "iris.delay.test-topic",
        expect.any(Buffer),
        expect.objectContaining({ expiration: expect.any(String) }),
        expect.any(Function),
      );
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
    });

    it("should not re-assert delay queue when already asserted", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      state.assertedDelayQueues.add("iris.delay.test-topic");
      const logger = createMockLogger();
      const metadata = createMetadata({
        retry: {
          maxRetries: 2,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: { "x-iris-attempt": "0" },
      });
      await wrapped(msg);

      expect(state.publishChannel!.assertQueue).not.toHaveBeenCalled();
    });

    it("should nack with requeue when retry publish fails", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const publishChannel = createMockPublishChannel();
      publishChannel.publish.mockImplementation(() => false);
      const state = createState({ publishChannel: publishChannel as any });
      const logger = createMockLogger();
      const metadata = createMetadata({
        retry: {
          maxRetries: 3,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: { "x-iris-attempt": "0" },
      });
      await wrapped(msg);

      expect(state.consumeChannel!.nack).toHaveBeenCalledWith(msg, false, false);
      expect(logger.error).toHaveBeenCalledWith(
        "Retry publish failed, sending to dead letter",
        expect.any(Object),
      );
    });

    it("should increment attempt in retry message headers", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const logger = createMockLogger();
      const metadata = createMetadata({
        retry: {
          maxRetries: 5,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: { "x-iris-attempt": "1" },
      });
      await wrapped(msg);

      const publishCall = (state.publishChannel!.publish as Mock).mock.calls[0];
      const publishOptions = publishCall[3];
      expect(publishOptions.headers["x-iris-attempt"]).toBe(2);
    });
  });

  describe("callback error - exhausted retries", () => {
    it("should publish to DLX with error headers and ack when dead letter is enabled and retries exhausted", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("permanent"));
      const state = createState();
      const metadata = createMetadata({
        deadLetter: true,
        retry: {
          maxRetries: 3,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: { "x-iris-attempt": "3" },
      });
      await wrapped(msg);

      // Should publish to DLX exchange instead of nacking
      expect(state.publishChannel!.publish).toHaveBeenCalledWith(
        "iris.dlx",
        "test-topic",
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-iris-error": "permanent",
            "x-iris-error-timestamp": expect.any(String),
          }),
        }),
        expect.any(Function),
      );
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
    });

    it("should ack (discard) when dead letter is disabled and retries exhausted", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({
        deadLetter: false,
        retry: {
          maxRetries: 3,
          strategy: "constant",
          delay: 1000,
          delayMax: 30000,
          multiplier: 2,
          jitter: false,
        },
      });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage({
        headers: { "x-iris-attempt": "3" },
      });
      await wrapped(msg);

      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
    });

    it("should publish to DLX when no retries configured and dead letter enabled", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage();
      await wrapped(msg);

      expect(state.publishChannel!.publish).toHaveBeenCalledWith(
        "iris.dlx",
        "test-topic",
        expect.any(Buffer),
        expect.objectContaining({
          headers: expect.objectContaining({
            "x-iris-error": "fail",
          }),
        }),
        expect.any(Function),
      );
      expect(state.consumeChannel!.ack).toHaveBeenCalledWith(msg);
      expect(state.consumeChannel!.nack).not.toHaveBeenCalled();
    });

    it("should nack as fallback when DLX publish fails", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const publishChannel = createMockPublishChannel();
      // First call succeeds (or is not relevant), DLX publish fails
      publishChannel.publish.mockImplementation(
        (
          _exchange: string,
          _routingKey: string,
          _content: Buffer,
          _options: any,
          cb: any,
        ) => {
          process.nextTick(() => cb(new Error("DLX publish failed")));
          return true;
        },
      );
      const state = createState({ publishChannel: publishChannel as any });
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      const msg = createConsumeMessage();
      await wrapped(msg);

      expect(state.consumeChannel!.nack).toHaveBeenCalledWith(msg, false, false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to publish to DLX, nacking",
        expect.any(Object),
      );
    });
  });

  describe("afterConsumeSuccess hook", () => {
    it("should log and swallow afterConsumeSuccess errors", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as Mock).mockRejectedValue(new Error("hook failed"));
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createConsumeMessage());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
      expect(state.consumeChannel!.ack).toHaveBeenCalled();
    });
  });

  describe("error wrapping", () => {
    it("should wrap non-Error callback throws into Error instances", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue("string error");
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapRabbitConsumer(host, callback, state, metadata, logger as any);

      await wrapped(createConsumeMessage());

      expect(host.onConsumeError).toHaveBeenCalledWith(
        expect.objectContaining({ message: "string error" }),
        { data: "hydrated" },
      );
    });
  });
});
