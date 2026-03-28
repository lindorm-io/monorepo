import type {
  KafkaClient,
  KafkaConsumer,
  KafkaEachMessagePayload,
  KafkaPooledConsumer,
  KafkaSharedState,
} from "../types/kafka-types";
import {
  awaitConsumerReady,
  createKafkaConsumer,
  getOrCreatePooledConsumer,
  createPooledDispatcher,
} from "./create-kafka-consumer";

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const KAFKA_CONSUMER_EVENTS = {
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
};

const createMockConsumer = (overrides?: Partial<KafkaConsumer>): KafkaConsumer => {
  const on = jest.fn((event: string, listener: (payload: unknown) => void) => {
    if (event === KAFKA_CONSUMER_EVENTS.GROUP_JOIN) {
      process.nextTick(() => listener({ memberAssignment: {} }));
    }
    return () => {};
  });

  return {
    connect: jest.fn().mockResolvedValue(undefined),
    disconnect: jest.fn().mockResolvedValue(undefined),
    subscribe: jest.fn().mockResolvedValue(undefined),
    run: jest.fn().mockResolvedValue(undefined),
    pause: jest.fn(),
    resume: jest.fn(),
    stop: jest.fn().mockResolvedValue(undefined),
    commitOffsets: jest.fn().mockResolvedValue(undefined),
    on,
    events: KAFKA_CONSUMER_EVENTS,
    ...overrides,
  };
};

const createMockKafka = (consumer?: KafkaConsumer): KafkaClient => ({
  producer: jest.fn() as any,
  consumer: jest.fn().mockReturnValue(consumer ?? createMockConsumer()),
  admin: jest.fn() as any,
});

const createMockState = (kafka?: KafkaClient): KafkaSharedState => ({
  kafka: kafka ?? createMockKafka(),
  admin: null,
  producer: null,
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
});

describe("createKafkaConsumer", () => {
  it("should create a consumer, connect, subscribe, and run", async () => {
    const mockConsumer = createMockConsumer();
    const kafka = createMockKafka(mockConsumer);
    const logger = createMockLogger();
    const onMessage = jest.fn().mockResolvedValue(undefined);

    const handle = await createKafkaConsumer({
      kafka,
      groupId: "iris.wq.test",
      topic: "iris.test-topic",
      onMessage,
      logger: logger as any,
    });

    expect(kafka.consumer).toHaveBeenCalledWith(
      expect.objectContaining({ groupId: "iris.wq.test" }),
    );
    expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: "iris.test-topic",
      fromBeginning: false,
    });
    expect(mockConsumer.run).toHaveBeenCalledWith(
      expect.objectContaining({ autoCommit: false }),
    );
    expect(handle.consumerTag).toBeDefined();
    expect(handle.groupId).toBe("iris.wq.test");
    expect(handle.topic).toBe("iris.test-topic");
    expect(handle.consumer).toBe(mockConsumer);
  });

  it("should pass sessionTimeoutMs to kafka.consumer", async () => {
    const kafka = createMockKafka();
    const logger = createMockLogger();

    await createKafkaConsumer({
      kafka,
      groupId: "test-group",
      topic: "test-topic",
      onMessage: jest.fn(),
      sessionTimeoutMs: 45000,
      logger: logger as any,
    });

    expect(kafka.consumer).toHaveBeenCalledWith({
      groupId: "test-group",
      sessionTimeout: 45000,
    });
  });

  it("should call onMessage in eachMessage handler", async () => {
    let capturedEachMessage:
      | ((payload: KafkaEachMessagePayload) => Promise<void>)
      | undefined;

    const mockConsumer = createMockConsumer({
      run: jest.fn().mockImplementation(async (opts: any) => {
        capturedEachMessage = opts.eachMessage;
      }),
    });
    const kafka = createMockKafka(mockConsumer);
    const logger = createMockLogger();
    const onMessage = jest.fn().mockResolvedValue(undefined);

    await createKafkaConsumer({
      kafka,
      groupId: "test-group",
      topic: "test-topic",
      onMessage,
      logger: logger as any,
    });

    expect(capturedEachMessage).toBeDefined();

    const payload: KafkaEachMessagePayload = {
      topic: "test-topic",
      partition: 0,
      message: {
        key: null,
        value: Buffer.from("test"),
        headers: {},
        offset: "0",
        timestamp: "0",
      },
      heartbeat: jest.fn().mockResolvedValue(undefined),
    };

    await capturedEachMessage!(payload);
    expect(onMessage).toHaveBeenCalledWith(payload);
  });

  it("should log and swallow errors from onMessage", async () => {
    let capturedEachMessage:
      | ((payload: KafkaEachMessagePayload) => Promise<void>)
      | undefined;

    const mockConsumer = createMockConsumer({
      run: jest.fn().mockImplementation(async (opts: any) => {
        capturedEachMessage = opts.eachMessage;
      }),
    });
    const kafka = createMockKafka(mockConsumer);
    const logger = createMockLogger();
    const onMessage = jest.fn().mockRejectedValue(new Error("handler error"));

    await createKafkaConsumer({
      kafka,
      groupId: "test-group",
      topic: "test-topic",
      onMessage,
      logger: logger as any,
    });

    const payload: KafkaEachMessagePayload = {
      topic: "test-topic",
      partition: 0,
      message: {
        key: null,
        value: Buffer.from("test"),
        headers: {},
        offset: "5",
        timestamp: "0",
      },
      heartbeat: jest.fn().mockResolvedValue(undefined),
    };

    await expect(capturedEachMessage!(payload)).resolves.toBeUndefined();

    expect(logger.error).toHaveBeenCalledWith(
      "Kafka eachMessage handler failed",
      expect.objectContaining({
        error: "handler error",
        topic: "test-topic",
        partition: 0,
        offset: "5",
      }),
    );
  });

  it("should generate a unique consumerTag", async () => {
    const kafka = createMockKafka();
    const logger = createMockLogger();

    const handle1 = await createKafkaConsumer({
      kafka,
      groupId: "test-group",
      topic: "test-topic",
      onMessage: jest.fn(),
      logger: logger as any,
    });

    const handle2 = await createKafkaConsumer({
      kafka,
      groupId: "test-group",
      topic: "test-topic",
      onMessage: jest.fn(),
      logger: logger as any,
    });

    expect(handle1.consumerTag).not.toBe(handle2.consumerTag);
  });
});

describe("getOrCreatePooledConsumer", () => {
  it("should create a new pooled consumer when none exists", async () => {
    const mockConsumer = createMockConsumer();
    const kafka = createMockKafka(mockConsumer);
    const state = createMockState(kafka);
    const logger = createMockLogger();
    const onMessage = jest.fn();

    const result = await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "test-topic",
      onMessage,
      logger: logger as any,
    });

    expect(result.consumerTag).toBeDefined();
    expect(state.consumerPool.has("test-group")).toBe(true);
    const pooled = state.consumerPool.get("test-group")!;
    expect(pooled.topics.has("test-topic")).toBe(true);
    expect(pooled.callbacks.get("test-topic")).toHaveLength(1);
    expect(pooled.roundRobinCounters).toBeDefined();
    expect(pooled.refCount).toBe(1);
    expect(mockConsumer.connect).toHaveBeenCalledTimes(1);
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: "test-topic",
      fromBeginning: false,
    });
    expect(mockConsumer.run).toHaveBeenCalledTimes(1);
  });

  it("should reuse existing pooled consumer for new topic", async () => {
    const mockConsumer = createMockConsumer();
    const kafka = createMockKafka(mockConsumer);
    const state = createMockState(kafka);
    const logger = createMockLogger();

    await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "topic-a",
      onMessage: jest.fn(),
      logger: logger as any,
    });

    await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "topic-b",
      onMessage: jest.fn(),
      logger: logger as any,
    });

    expect(state.consumerPool.size).toBe(1);
    const pooled = state.consumerPool.get("test-group")!;
    expect(pooled.topics.size).toBe(2);
    expect(pooled.refCount).toBe(2);
    expect(mockConsumer.stop).toHaveBeenCalledTimes(1);
    // subscribe called: once for initial, then twice during resubscribe (both topics)
    expect(mockConsumer.subscribe).toHaveBeenCalledTimes(3);
    expect(mockConsumer.run).toHaveBeenCalledTimes(2);
  });

  it("should increment refCount and append callback when same topic is added again", async () => {
    const mockConsumer = createMockConsumer();
    const kafka = createMockKafka(mockConsumer);
    const state = createMockState(kafka);
    const logger = createMockLogger();
    const cb1 = jest.fn();
    const cb2 = jest.fn();

    await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "topic-a",
      onMessage: cb1,
      logger: logger as any,
    });

    await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "topic-a",
      onMessage: cb2,
      logger: logger as any,
    });

    const pooled = state.consumerPool.get("test-group")!;
    expect(pooled.refCount).toBe(2);
    expect(pooled.callbacks.get("topic-a")).toHaveLength(2);
    expect(pooled.callbacks.get("topic-a")).toEqual([cb1, cb2]);
    // No stop/restart needed when topic already exists
    expect(mockConsumer.stop).not.toHaveBeenCalled();
  });

  it("should throw when kafka client is not connected", async () => {
    const state = createMockState();
    state.kafka = null;
    const logger = createMockLogger();

    await expect(
      getOrCreatePooledConsumer({
        state,
        groupId: "test-group",
        topic: "test-topic",
        onMessage: jest.fn(),
        logger: logger as any,
      }),
    ).rejects.toThrow("Cannot create pooled consumer: Kafka client is not connected");
  });

  it("should add consumer handle to state.consumers on new pool entry", async () => {
    const mockConsumer = createMockConsumer();
    const kafka = createMockKafka(mockConsumer);
    const state = createMockState(kafka);
    const logger = createMockLogger();

    await getOrCreatePooledConsumer({
      state,
      groupId: "test-group",
      topic: "test-topic",
      onMessage: jest.fn(),
      logger: logger as any,
    });

    expect(state.consumers).toHaveLength(1);
    expect(state.consumers[0].groupId).toBe("test-group");
    expect(state.consumers[0].consumer).toBe(mockConsumer);
  });
});

describe("awaitConsumerReady", () => {
  it("should resolve when GROUP_JOIN fires", async () => {
    const consumer = createMockConsumer();
    await expect(awaitConsumerReady(consumer)).resolves.toBeUndefined();
    expect(consumer.on).toHaveBeenCalledWith(
      KAFKA_CONSUMER_EVENTS.GROUP_JOIN,
      expect.any(Function),
    );
  });

  it("should reject on timeout", async () => {
    const consumer = createMockConsumer({
      on: jest.fn().mockReturnValue(() => {}),
    });

    await expect(awaitConsumerReady(consumer, 50)).rejects.toThrow(
      "Kafka consumer ready timed out after 50ms",
    );
  });

  it("should clean up listener on timeout", async () => {
    const removeListener = jest.fn();
    const consumer = createMockConsumer({
      on: jest.fn().mockReturnValue(removeListener),
    });

    await expect(awaitConsumerReady(consumer, 50)).rejects.toThrow();
    expect(removeListener).toHaveBeenCalled();
  });
});

describe("createPooledDispatcher", () => {
  const makePooled = (callbacks: Map<string, Array<jest.Mock>>): KafkaPooledConsumer => ({
    consumer: createMockConsumer(),
    groupId: "test-group",
    topics: new Set(callbacks.keys()),
    callbacks: callbacks as any,
    roundRobinCounters: new Map(),
    localAbort: new AbortController(),
    refCount: Array.from(callbacks.values()).reduce((sum, arr) => sum + arr.length, 0),
  });

  const makePayload = (topic: string, offset = "0"): KafkaEachMessagePayload => ({
    topic,
    partition: 0,
    message: {
      key: null,
      value: Buffer.from("test"),
      headers: {},
      offset,
      timestamp: "0",
    },
    heartbeat: jest.fn().mockResolvedValue(undefined),
  });

  it("should route messages to the correct callback", async () => {
    const callback = jest.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const pooled = makePooled(new Map([["topic-a", [callback]]]));

    const dispatcher = createPooledDispatcher(pooled, logger as any);
    const payload = makePayload("topic-a");

    await dispatcher(payload);
    expect(callback).toHaveBeenCalledWith(payload);
  });

  it("should warn when no callback found for topic", async () => {
    const logger = createMockLogger();
    const pooled = makePooled(new Map());

    const dispatcher = createPooledDispatcher(pooled, logger as any);
    const payload = makePayload("unknown-topic");

    await dispatcher(payload);
    expect(logger.warn).toHaveBeenCalledWith(
      "Received message for unregistered topic in pooled consumer",
      expect.objectContaining({ topic: "unknown-topic" }),
    );
  });

  it("should log and swallow errors from callback", async () => {
    const callback = jest.fn().mockRejectedValue(new Error("oops"));
    const logger = createMockLogger();
    const pooled = makePooled(new Map([["topic-a", [callback]]]));

    const dispatcher = createPooledDispatcher(pooled, logger as any);
    const payload = makePayload("topic-a", "3");

    await expect(dispatcher(payload)).resolves.toBeUndefined();
    expect(logger.error).toHaveBeenCalledWith(
      "Kafka pooled eachMessage handler failed",
      expect.objectContaining({
        error: "oops",
        topic: "topic-a",
        offset: "3",
      }),
    );
  });

  it("should round-robin across multiple callbacks for the same topic", async () => {
    const cb1 = jest.fn().mockResolvedValue(undefined);
    const cb2 = jest.fn().mockResolvedValue(undefined);
    const cb3 = jest.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const pooled = makePooled(new Map([["topic-a", [cb1, cb2, cb3]]]));

    const dispatcher = createPooledDispatcher(pooled, logger as any);

    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));

    expect(cb1).toHaveBeenCalledTimes(2);
    expect(cb2).toHaveBeenCalledTimes(2);
    expect(cb3).toHaveBeenCalledTimes(2);
  });

  it("should maintain separate round-robin counters per topic", async () => {
    const cbA1 = jest.fn().mockResolvedValue(undefined);
    const cbA2 = jest.fn().mockResolvedValue(undefined);
    const cbB1 = jest.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const pooled = makePooled(
      new Map([
        ["topic-a", [cbA1, cbA2]],
        ["topic-b", [cbB1]],
      ]),
    );

    const dispatcher = createPooledDispatcher(pooled, logger as any);

    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-b"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-b"));

    expect(cbA1).toHaveBeenCalledTimes(1);
    expect(cbA2).toHaveBeenCalledTimes(1);
    expect(cbB1).toHaveBeenCalledTimes(2);
  });

  it("should behave identically to single callback when only one is registered", async () => {
    const cb = jest.fn().mockResolvedValue(undefined);
    const logger = createMockLogger();
    const pooled = makePooled(new Map([["topic-a", [cb]]]));

    const dispatcher = createPooledDispatcher(pooled, logger as any);

    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));
    await dispatcher(makePayload("topic-a"));

    expect(cb).toHaveBeenCalledTimes(3);
  });
});
