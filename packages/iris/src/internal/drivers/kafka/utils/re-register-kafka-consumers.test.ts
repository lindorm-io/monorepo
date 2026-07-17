import type {
  KafkaClient,
  KafkaConsumer,
  KafkaConsumerRegistration,
  KafkaPooledConsumer,
  KafkaSharedState,
} from "../types/kafka-types.js";
import { reRegisterKafkaConsumers } from "./re-register-kafka-consumers.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
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
  const on = vi.fn((event: string, listener: (payload: unknown) => void) => {
    if (event === KAFKA_CONSUMER_EVENTS.GROUP_JOIN) {
      process.nextTick(() => listener({ memberAssignment: {} }));
    }
    return () => {};
  });

  return {
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockResolvedValue(undefined),
    run: vi.fn().mockResolvedValue(undefined),
    pause: vi.fn(),
    resume: vi.fn(),
    seek: vi.fn(),
    stop: vi.fn().mockResolvedValue(undefined),
    commitOffsets: vi.fn().mockResolvedValue(undefined),
    on,
    events: KAFKA_CONSUMER_EVENTS,
    ...overrides,
  };
};

// A kafka client that hands out a fresh consumer per call, tracking each one.
const createMockKafka = (): { kafka: KafkaClient; created: Array<KafkaConsumer> } => {
  const created: Array<KafkaConsumer> = [];
  const kafka: KafkaClient = {
    producer: vi.fn() as any,
    admin: vi.fn(() => ({
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      listTopics: vi.fn().mockResolvedValue([]),
      createTopics: vi.fn().mockResolvedValue(true),
      deleteTopics: vi.fn().mockResolvedValue(undefined),
      fetchTopicOffsets: vi
        .fn()
        .mockResolvedValue([{ partition: 0, offset: "0", high: "0", low: "0" }]),
    })) as any,
    consumer: vi.fn(() => {
      const c = createMockConsumer();
      created.push(c);
      return c;
    }),
  };
  return { kafka, created };
};

const createState = (kafka: KafkaClient): KafkaSharedState => ({
  kafka,
  admin: null,
  producer: null,
  connectionConfig: { brokers: ["localhost:9092"] },
  prefix: "iris",
  consumers: [],
  consumerRegistrations: [],
  consumerPool: new Map(),
  retryConsumers: new Map(),
  inFlightCount: 0,
  prefetch: 10,
  sessionTimeoutMs: 30000,
  acks: -1,
  createdTopics: new Set(),
  publishedTopics: new Set(),
  abortController: new AbortController(),
  resetGeneration: 0,
});

const pooledReg = (
  overrides: Partial<KafkaConsumerRegistration> = {},
): KafkaConsumerRegistration => ({
  consumerTag: "con_pooled",
  groupId: "iris.worker.q",
  topic: "iris.Topic",
  onMessage: vi.fn().mockResolvedValue(undefined),
  pooled: true,
  ...overrides,
});

describe("reRegisterKafkaConsumers", () => {
  let logger: ReturnType<typeof createMockLogger>;

  beforeEach(() => {
    logger = createMockLogger();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it("no-ops when kafka client is not connected", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);
    state.kafka = null;
    state.consumerRegistrations.push(pooledReg());

    await reRegisterKafkaConsumers(state, logger as any);

    expect(state.consumerPool.size).toBe(0);
    expect(state.consumers).toHaveLength(0);
  });

  it("no-ops when the registry is empty", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);

    await reRegisterKafkaConsumers(state, logger as any);

    expect(kafka.consumer).not.toHaveBeenCalled();
  });

  it("rebuilds a pooled consumer from its registration", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);
    state.consumerRegistrations.push(pooledReg());

    await reRegisterKafkaConsumers(state, logger as any);

    expect(state.consumerPool.has("iris.worker.q")).toBe(true);
    expect(state.consumers).toHaveLength(1);
    expect(state.consumers[0].groupId).toBe("iris.worker.q");
    const pooled = state.consumerPool.get("iris.worker.q")!;
    expect(pooled.callbacks.get("iris.Topic")).toHaveLength(1);
  });

  it("rebuilds a dedicated (stream) consumer reusing its consumer tag", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);
    state.consumerRegistrations.push(
      pooledReg({
        consumerTag: "con_stream",
        groupId: "iris.pipeline.abc",
        pooled: false,
      }),
    );

    await reRegisterKafkaConsumers(state, logger as any);

    expect(state.consumers).toHaveLength(1);
    // The rebuilt handle keeps the original tag so the pipeline's cached tag
    // still matches.
    expect(state.consumers[0].consumerTag).toBe("con_stream");
    expect(state.consumerPool.size).toBe(0);
  });

  it("tears down a stale pooled consumer before rebuilding (no duplicate)", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);

    const staleConsumer = createMockConsumer();
    const stalePooled: KafkaPooledConsumer = {
      consumer: staleConsumer,
      groupId: "iris.worker.q",
      topics: new Set(["iris.Topic"]),
      callbacks: new Map([["iris.Topic", [vi.fn()]]]),
      roundRobinCounters: new Map(),
      refCount: 1,
      localAbort: new AbortController(),
    };
    state.consumerPool.set("iris.worker.q", stalePooled);
    state.consumers.push({
      consumerTag: "con_stale",
      groupId: "iris.worker.q",
      topic: "iris.Topic",
      consumer: staleConsumer,
    });
    state.consumerRegistrations.push(pooledReg());

    await reRegisterKafkaConsumers(state, logger as any);

    // Stale consumer stopped + disconnected, and exactly one pool entry remains.
    expect(staleConsumer.stop).toHaveBeenCalled();
    expect(staleConsumer.disconnect).toHaveBeenCalled();
    expect(state.consumerPool.size).toBe(1);
    expect(state.consumers).toHaveLength(1);
    expect(state.consumerPool.get("iris.worker.q")!.consumer).not.toBe(staleConsumer);
  });

  it("restores competing consumers sharing a group as one consumer with two callbacks", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);
    state.consumerRegistrations.push(
      pooledReg({ consumerTag: "con_a" }),
      pooledReg({ consumerTag: "con_b" }),
    );

    await reRegisterKafkaConsumers(state, logger as any);

    // One pooled consumer, both callbacks attached — no stacked duplicate.
    expect(state.consumerPool.size).toBe(1);
    expect(state.consumers).toHaveLength(1);
    expect(
      state.consumerPool.get("iris.worker.q")!.callbacks.get("iris.Topic"),
    ).toHaveLength(2);
    expect(state.consumerPool.get("iris.worker.q")!.refCount).toBe(2);
  });

  it("leaves consumers not in the registry untouched", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);

    // A request-scoped RPC reply consumer lives in state.consumers but not the
    // registry — reReg must not stop or drop it.
    const replyConsumer = createMockConsumer();
    state.consumers.push({
      consumerTag: "con_reply",
      groupId: "iris.rpc.reply.x",
      topic: "iris.rpc.reply.x",
      consumer: replyConsumer,
    });
    state.consumerRegistrations.push(pooledReg());

    await reRegisterKafkaConsumers(state, logger as any);

    expect(replyConsumer.stop).not.toHaveBeenCalled();
    expect(replyConsumer.disconnect).not.toHaveBeenCalled();
    expect(state.consumers.some((c) => c.consumerTag === "con_reply")).toBe(true);
  });

  it("logs and continues when one registration fails to rebuild", async () => {
    const { kafka } = createMockKafka();
    const state = createState(kafka);

    // First consumer() call throws, second succeeds.
    let call = 0;
    (kafka.consumer as any).mockImplementation(() => {
      call++;
      if (call === 1) throw new Error("boom");
      return createMockConsumer();
    });

    state.consumerRegistrations.push(
      pooledReg({ consumerTag: "con_a", groupId: "iris.worker.a", topic: "iris.A" }),
      pooledReg({ consumerTag: "con_b", groupId: "iris.worker.b", topic: "iris.B" }),
    );

    await reRegisterKafkaConsumers(state, logger as any);

    expect(logger.error).toHaveBeenCalled();
    // The second registration still rebuilt.
    expect(state.consumerPool.has("iris.worker.b")).toBe(true);
  });
});
