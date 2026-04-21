import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { KafkaEachMessagePayload, KafkaSharedState } from "../types/kafka-types.js";
import {
  wrapKafkaConsumer,
  type KafkaConsumerCallbackHost,
} from "./wrap-kafka-consumer.js";
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

const createMockHost = <M extends IMessage>(): KafkaConsumerCallbackHost<M> => ({
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

const createMockConsumer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockResolvedValue(undefined),
  run: vi.fn().mockResolvedValue(undefined),
  pause: vi.fn(),
  resume: vi.fn(),
  stop: vi.fn().mockResolvedValue(undefined),
  commitOffsets: vi.fn().mockResolvedValue(undefined),
  on: vi.fn().mockReturnValue(() => {}),
  events: {
    GROUP_JOIN: "consumer.group_join",
    HEARTBEAT: "consumer.heartbeat",
    COMMIT_OFFSETS: "consumer.commit_offsets",
    STOP: "consumer.stop",
    DISCONNECT: "consumer.disconnect",
    CONNECT: "consumer.connect",
    FETCH_START: "consumer.fetch_start",
    FETCH: "consumer.fetch",
    START_BATCH_PROCESS: "consumer.start_batch_process",
    END_BATCH_PROCESS: "consumer.end_batch_process",
    CRASH: "consumer.crash",
    RECEIVED_UNSUBSCRIBED_TOPICS: "consumer.received_unsubscribed_topics",
    REQUEST_TIMEOUT: "consumer.request_timeout",
  },
});

const createMockProducer = () => ({
  connect: vi.fn().mockResolvedValue(undefined),
  disconnect: vi.fn().mockResolvedValue(undefined),
  send: vi.fn().mockResolvedValue(undefined),
});

const createHeaders = (
  overrides: Record<string, string> = {},
): Record<string, Buffer | undefined> => {
  const defaults: Record<string, string> = {
    "x-iris-topic": "test-topic",
    "x-iris-headers": JSON.stringify({}),
    "x-iris-attempt": "0",
    "x-iris-max-retries": "0",
    "x-iris-retry-strategy": "constant",
    "x-iris-retry-delay": "100",
    "x-iris-retry-delay-max": "30000",
    "x-iris-retry-multiplier": "2",
    "x-iris-retry-jitter": "false",
    "x-iris-priority": "0",
    "x-iris-timestamp": String(Date.now()),
    "x-iris-expiry": "",
    "x-iris-broadcast": "false",
    "x-iris-reply-to": "",
    "x-iris-correlation-id": "",
  };

  const merged = { ...defaults, ...overrides };
  const result: Record<string, Buffer | undefined> = {};
  for (const [key, value] of Object.entries(merged)) {
    result[key] = Buffer.from(value);
  }
  return result;
};

const createPayload = (
  overrides?: Partial<{
    topic: string;
    partition: number;
    headers: Record<string, Buffer | undefined>;
    value: Buffer | null;
    offset: string;
    timestamp: string;
  }>,
): KafkaEachMessagePayload => ({
  topic: overrides?.topic ?? "test-topic",
  partition: overrides?.partition ?? 0,
  message: {
    key: null,
    value: overrides?.value ?? Buffer.from('{"data":"test"}'),
    headers: overrides?.headers ?? createHeaders(),
    offset: overrides?.offset ?? "42",
    timestamp: overrides?.timestamp ?? "1700000000000",
  },
  heartbeat: vi.fn().mockResolvedValue(undefined),
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

const createState = (overrides?: Partial<KafkaSharedState>): KafkaSharedState => ({
  kafka: null,
  admin: null,
  producer: createMockProducer() as any,
  connectionConfig: { brokers: ["localhost:9092"] },
  prefix: "iris",
  consumers: [],
  consumerRegistrations: [],
  consumerPool: new Map(),
  inFlightCount: 0,
  prefetch: 10,
  sessionTimeoutMs: 30000,
  acks: -1,
  createdTopics: new Set(),
  publishedTopics: new Set(),
  abortController: new AbortController(),
  resetGeneration: 0,
  ...overrides,
});

describe("wrapKafkaConsumer", () => {
  describe("happy path", () => {
    it("should call prepareForConsume, callback, and afterConsumeSuccess", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      const payload = createPayload();
      await wrapped(payload);

      expect(host.prepareForConsume).toHaveBeenCalledWith(payload.message.value, {});
      expect(callback).toHaveBeenCalledWith(
        { data: "hydrated" },
        expect.objectContaining({
          topic: "test-topic",
          attempt: 0,
        }),
      );
      expect(host.afterConsumeSuccess).toHaveBeenCalledWith({ data: "hydrated" });
    });

    it("should commit offsets after successful processing", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      await wrapped(createPayload({ offset: "42" }));

      expect(consumer.commitOffsets).toHaveBeenCalledWith([
        { topic: "test-topic", partition: 0, offset: "43" },
      ]);
    });

    it("should pass ConsumeEnvelope with metadata fields to callback", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const metadata = createMetadata({ namespace: "my-ns", version: 3 });
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-topic": "orders.created",
          "x-iris-headers": JSON.stringify({ "x-trace": "abc" }),
          "x-iris-attempt": "2",
          "x-iris-correlation-id": "corr-1",
          "x-iris-timestamp": "1700000000000",
        }),
      });
      await wrapped(payload);

      const consumeEnvelope: ConsumeEnvelope = callback.mock.calls[0][1];
      expect(consumeEnvelope).toMatchSnapshot();
    });

    it("should decrement inFlightCount after processing", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      await wrapped(createPayload());
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
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      await wrapped(createPayload());
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
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-timestamp": String(Date.now() - 10_000),
          "x-iris-expiry": "1000",
        }),
      });
      await wrapped(payload);

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
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      const payload = createPayload({
        headers: createHeaders({ "x-iris-expiry": "" }),
      });
      await wrapped(payload);

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
      const consumer = createMockConsumer();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
        deadLetterManager,
      });

      await wrapped(createPayload());

      expect(callback).not.toHaveBeenCalled();
      expect(host.onConsumeError).not.toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "Deserialization failed, sending to dead letter",
        expect.any(Object),
      );
      expect(deadLetterManager.send).toHaveBeenCalled();
    });

    it("should not send to dead letter when no manager provided", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      await wrapped(createPayload());

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
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-max-retries": "3",
          "x-iris-retry-delay": "100",
        }),
      });
      await wrapped(payload);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(state.producer!.send).toHaveBeenCalledTimes(1);

      const sendArgs = (state.producer!.send as Mock).mock.calls[0][0];
      const kafkaHeaders = sendArgs.messages[0].headers;
      expect(kafkaHeaders["x-iris-attempt"]).toBe("1");
    });

    it("should schedule retry via delayManager when available", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();
      const consumer = createMockConsumer();
      const delayManager = { schedule: vi.fn().mockResolvedValue("delay-id") } as any;

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
        delayManager,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-max-retries": "3",
          "x-iris-retry-delay": "100",
        }),
      });
      await wrapped(payload);

      expect(host.onConsumeError).toHaveBeenCalled();
      expect(delayManager.schedule).toHaveBeenCalledTimes(1);
      expect(delayManager.schedule).toHaveBeenCalledWith(
        expect.objectContaining({ attempt: 1, topic: "test-topic" }),
        "test-topic",
        expect.any(Number),
      );
      expect(state.producer!.send).not.toHaveBeenCalled();
    });

    it("should not retry when attempt >= maxRetries", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const metadata = createMetadata();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-attempt": "3",
          "x-iris-max-retries": "3",
        }),
      });
      await wrapped(payload);

      expect(state.producer!.send).not.toHaveBeenCalled();
    });
  });

  describe("callback error - exhausted retries", () => {
    it("should send to dead letter when retries exhausted and dead letter enabled", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("permanent"));
      const state = createState();
      const metadata = createMetadata({ deadLetter: true });
      const logger = createMockLogger();
      const consumer = createMockConsumer();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
        deadLetterManager,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-attempt": "3",
          "x-iris-max-retries": "3",
        }),
      });
      await wrapped(payload);

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
      const consumer = createMockConsumer();
      const deadLetterManager = createMockDeadLetterManager();

      const wrapped = wrapKafkaConsumer(host, callback, state, metadata, logger as any, {
        consumer: consumer as any,
        deadLetterManager,
      });

      const payload = createPayload({
        headers: createHeaders({
          "x-iris-attempt": "3",
          "x-iris-max-retries": "3",
        }),
      });
      await wrapped(payload);

      expect(deadLetterManager.send).not.toHaveBeenCalled();
    });
  });

  describe("afterConsumeSuccess hook", () => {
    it("should log and swallow afterConsumeSuccess errors", async () => {
      const host = createMockHost();
      (host.afterConsumeSuccess as Mock).mockRejectedValue(new Error("hook failed"));
      const callback = vi.fn().mockResolvedValue(undefined);
      const state = createState();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      await wrapped(createPayload());

      expect(callback).toHaveBeenCalledTimes(1);
      expect(host.afterConsumeSuccess).toHaveBeenCalled();
      expect(logger.error).toHaveBeenCalledWith(
        "afterConsumeSuccess hook failed",
        expect.any(Object),
      );
    });
  });

  describe("inFlightCount management", () => {
    it("should decrement inFlightCount even on error", async () => {
      const host = createMockHost();
      const callback = vi.fn().mockRejectedValue(new Error("fail"));
      const state = createState();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      await wrapped(createPayload());
      expect(state.inFlightCount).toBe(0);
    });

    it("should decrement inFlightCount on deserialization failure", async () => {
      const host = createMockHost();
      (host.prepareForConsume as Mock).mockRejectedValue(new Error("bad data"));
      const callback = vi.fn();
      const state = createState();
      const logger = createMockLogger();
      const consumer = createMockConsumer();

      const wrapped = wrapKafkaConsumer(
        host,
        callback,
        state,
        createMetadata(),
        logger as any,
        { consumer: consumer as any },
      );

      await wrapped(createPayload());
      expect(state.inFlightCount).toBe(0);
    });
  });
});
