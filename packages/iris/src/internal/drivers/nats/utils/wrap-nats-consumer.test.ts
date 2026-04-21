import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { NatsJsMsg, NatsSharedState } from "../types/nats-types.js";
import { parseNatsMessage as _parseNatsMessage } from "./parse-nats-message.js";
import { wrapNatsConsumer, type NatsConsumerCallbackHost } from "./wrap-nats-consumer.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const parseNatsMessage = _parseNatsMessage as unknown as Mock;

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockHost = <M extends IMessage>(): NatsConsumerCallbackHost<M> => ({
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

const createMockMsg = (overrides?: Partial<NatsJsMsg>): NatsJsMsg => ({
  data: Buffer.from('{"data":"test"}') as unknown as Uint8Array,
  subject: "test.events",
  seq: 1,
  info: {
    stream: "IRIS_TEST",
    consumer: "test-consumer",
    redelivered: false,
    deliveryCount: 1,
  },
  ack: vi.fn(),
  nak: vi.fn(),
  working: vi.fn(),
  term: vi.fn(),
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

const createState = (overrides?: Partial<NatsSharedState>): NatsSharedState => ({
  nc: {} as any,
  js: {
    publish: vi.fn().mockResolvedValue({ seq: 1, stream: "IRIS_TEST", duplicate: false }),
  } as any,
  jsm: null,
  headersInit: vi.fn() as any,
  prefix: "iris",
  streamName: "IRIS_IRIS",
  consumerLoops: [],
  consumerRegistrations: [],
  ensuredConsumers: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  ...overrides,
});

// Mock parseNatsMessage to return an IrisEnvelope
vi.mock("./parse-nats-message.js", async () => ({
  parseNatsMessage: vi.fn().mockReturnValue({
    topic: "test-topic",
    payload: Buffer.from('{"data":"test"}'),
    headers: {},
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
  }),
}));

describe("wrapNatsConsumer", () => {
  describe("happy path", () => {
    it("should call prepareForConsume, callback, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      const msg = createMockMsg();
      await wrapped(msg);

      expect(host.prepareForConsume).toHaveBeenCalled();
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({
          topic: "test-topic",
        }),
      );
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
      expect(msg.ack).toHaveBeenCalled();
    });

    it("should pass ConsumeEnvelope with metadata fields to callback", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata({ namespace: "my-ns", version: 3 });
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      await wrapped(createMockMsg());

      const consumeEnvelope: ConsumeEnvelope = callback.mock.calls[0][1];
      expect(consumeEnvelope).toEqual(
        expect.objectContaining({
          topic: "test-topic",
          namespace: "my-ns",
          version: 3,
          attempt: 0,
          correlationId: null,
          headers: {},
          timestamp: expect.any(Number),
        }),
      );
    });

    it("should decrement inFlightCount after processing", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createMockMsg());
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

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createMockMsg());
      expect(captured).toBe(1);
      expect(state.inFlightCount).toBe(0);
    });
  });

  describe("expiry", () => {
    it("should skip expired messages and ack", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now() - 10_000,
        expiry: 1000,
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
      });

      const host = createMockHost();
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createMockMsg();
      await wrapped(msg);

      expect(host.prepareForConsume).not.toHaveBeenCalled();
      expect(callback).not.toHaveBeenCalled();
      expect(msg.ack).toHaveBeenCalled();
      expect(logger.debug).toHaveBeenCalledWith(
        "Skipping expired message",
        expect.any(Object),
      );
    });
  });

  describe("deserialization failure", () => {
    it("should send to dead letter and term on deserialization error when deadLetter enabled", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      const msg = createMockMsg();
      await wrapped(msg);

      expect(callback).not.toHaveBeenCalled();
      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(deadLetterManager.send).toHaveBeenCalled();
      expect(msg.term).toHaveBeenCalledWith("deserialization_error");
    });

    it("should ack and discard on deserialization error when deadLetter is false", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const metadata = createMetadata({ deadLetter: false });
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      const msg = createMockMsg();
      await wrapped(msg);

      expect(callback).not.toHaveBeenCalled();
      expect(msg.ack).toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization error, discarding message (no dead letter configured)",
        expect.any(Object),
      );
    });

    it("should wrap non-Error deserialization failures", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue("string error");
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createMockMsg();
      await wrapped(msg);

      expect(logger.error).toHaveBeenCalledWith(
        expect.any(String),
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

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      const msg = createMockMsg();
      await wrapped(msg);

      // With deadLetter: true but no deadLetterManager, sendToDeadLetter is a no-op
      // but term is still called
      expect(msg.term).toHaveBeenCalledWith("deserialization_error");
    });
  });

  describe("callback error - retry", () => {
    it("should nak with delay when retries remain", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      const msg = createMockMsg();
      await wrapped(msg);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(msg.nak).toHaveBeenCalledWith(expect.any(Number));
      expect(msg.ack).not.toHaveBeenCalled();
      expect(msg.term).not.toHaveBeenCalled();
    });

    it("should use native deliveryCount for attempt tracking", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      // Simulate second delivery: deliveryCount=2 means attempt=1
      const msg = createMockMsg({
        info: {
          stream: "IRIS_TEST",
          consumer: "test-consumer",
          redelivered: true,
          deliveryCount: 2,
        },
      });
      await wrapped(msg);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(msg.nak).toHaveBeenCalledWith(expect.any(Number));
    });

    it("should not retry when attempt >= maxRetries", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      // deliveryCount=4 means attempt=3 (4-1), which equals maxRetries=3
      const msg = createMockMsg({
        info: {
          stream: "IRIS_TEST",
          consumer: "test-consumer",
          redelivered: true,
          deliveryCount: 4,
        },
      });
      await wrapped(msg);

      expect(msg.nak).not.toHaveBeenCalled();
      expect(msg.term).toHaveBeenCalledWith("retries_exhausted");
    });
  });

  describe("callback error - exhausted retries", () => {
    it("should send to dead letter and term when retries exhausted and dead letter enabled", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("permanent"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      const msg = createMockMsg({
        info: {
          stream: "IRIS_TEST",
          consumer: "test-consumer",
          redelivered: true,
          deliveryCount: 4,
        },
      });
      await wrapped(msg);

      expect(deadLetterManager.send).toHaveBeenCalledWith(
        expect.objectContaining({ topic: "test-topic" }),
        "test-topic",
        expect.objectContaining({ message: "permanent" }),
      );
      expect(msg.term).toHaveBeenCalledWith("dead_letter");
    });

    it("should term without dead letter when dead letter is disabled", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: false });
      const logger = createMockLogger();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      const msg = createMockMsg({
        info: {
          stream: "IRIS_TEST",
          consumer: "test-consumer",
          redelivered: true,
          deliveryCount: 4,
        },
      });
      await wrapped(msg);

      expect(deadLetterManager.send).not.toHaveBeenCalled();
      expect(msg.term).toHaveBeenCalledWith("retries_exhausted");
    });

    it("should not crash when dead letter enabled but no manager provided", async () => {
      parseNatsMessage.mockReturnValueOnce({
        topic: "test-topic",
        payload: Buffer.from('{"data":"test"}'),
        headers: {},
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 3,
        retryStrategy: "constant",
        retryDelay: 100,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      });

      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any);

      const msg = createMockMsg({
        info: {
          stream: "IRIS_TEST",
          consumer: "test-consumer",
          redelivered: true,
          deliveryCount: 4,
        },
      });
      await expect(wrapped(msg)).resolves.toBeUndefined();
      expect(msg.term).toHaveBeenCalled();
    });
  });

  describe("afterConsumeSuccess hook", () => {
    it("should log and swallow afterConsumeSuccess errors", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as Mock).mockRejectedValue(new Error("hook failed"));
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      const msg = createMockMsg();
      await wrapped(msg);

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
      expect(msg.ack).toHaveBeenCalled();
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

      const wrapped = wrapNatsConsumer(host, callback, state, metadata, logger as any, {
        deadLetterManager,
      });

      await wrapped(createMockMsg());

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

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createMockMsg());
      expect(state.inFlightCount).toBe(0);
    });

    it("should decrement inFlightCount on deserialization failure", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();

      const wrapped = wrapNatsConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
      );

      await wrapped(createMockMsg());
      expect(state.inFlightCount).toBe(0);
    });
  });
});
