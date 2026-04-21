import type {
  KafkaSharedState,
  KafkaConsumerHandle,
  KafkaConsumer,
} from "../types/kafka-types";
import {
  stopKafkaConsumer,
  stopAllKafkaConsumers,
  releasePooledConsumer,
} from "./stop-kafka-consumer";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockConsumer = (): KafkaConsumer => ({
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

const createMockConsumerHandle = (
  consumerTag: string,
  overrides?: Partial<KafkaConsumerHandle>,
): KafkaConsumerHandle => ({
  consumerTag,
  groupId: `group-${consumerTag}`,
  topic: `topic-${consumerTag}`,
  consumer: createMockConsumer(),
  ...overrides,
});

const createMockState = (consumers?: Array<KafkaConsumerHandle>): KafkaSharedState => ({
  kafka: null,
  admin: null,
  producer: null,
  connectionConfig: { brokers: ["localhost:9092"] },
  prefix: "iris",
  consumers: consumers ?? [],
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

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

describe("stopKafkaConsumer", () => {
  it("should stop, disconnect, and remove the consumer", async () => {
    const handle = createMockConsumerHandle("ctag-1");
    const state = createMockState([handle]);

    await stopKafkaConsumer(state, "ctag-1");

    expect(handle.consumer.stop).toHaveBeenCalledTimes(1);
    expect(handle.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(state.consumers).toHaveLength(0);
  });

  it("should be a no-op for unknown consumerTag", async () => {
    const handle = createMockConsumerHandle("ctag-1");
    const state = createMockState([handle]);

    await stopKafkaConsumer(state, "unknown");

    expect(state.consumers).toHaveLength(1);
    expect(handle.consumer.stop).not.toHaveBeenCalled();
  });

  it("should not throw if stop throws", async () => {
    const handle = createMockConsumerHandle("ctag-1");
    (handle.consumer.stop as Mock).mockRejectedValue(new Error("stop failed"));
    const state = createMockState([handle]);

    await expect(stopKafkaConsumer(state, "ctag-1")).resolves.toBeUndefined();
    expect(state.consumers).toHaveLength(0);
  });

  it("should not throw if disconnect throws", async () => {
    const handle = createMockConsumerHandle("ctag-1");
    (handle.consumer.disconnect as Mock).mockRejectedValue(
      new Error("disconnect failed"),
    );
    const state = createMockState([handle]);

    await expect(stopKafkaConsumer(state, "ctag-1")).resolves.toBeUndefined();
    expect(state.consumers).toHaveLength(0);
  });

  it("should only remove the targeted consumer from multiple consumers", async () => {
    const handle1 = createMockConsumerHandle("ctag-1");
    const handle2 = createMockConsumerHandle("ctag-2");
    const state = createMockState([handle1, handle2]);

    await stopKafkaConsumer(state, "ctag-1");

    expect(state.consumers).toHaveLength(1);
    expect(state.consumers[0].consumerTag).toBe("ctag-2");
    expect(handle2.consumer.stop).not.toHaveBeenCalled();
  });
});

describe("stopAllKafkaConsumers", () => {
  it("should stop and disconnect all consumers", async () => {
    const handle1 = createMockConsumerHandle("ctag-1");
    const handle2 = createMockConsumerHandle("ctag-2");
    const state = createMockState([handle1, handle2]);

    await stopAllKafkaConsumers(state);

    expect(handle1.consumer.stop).toHaveBeenCalledTimes(1);
    expect(handle1.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(handle2.consumer.stop).toHaveBeenCalledTimes(1);
    expect(handle2.consumer.disconnect).toHaveBeenCalledTimes(1);
    expect(state.consumers).toHaveLength(0);
  });

  it("should handle empty consumers array", async () => {
    const state = createMockState([]);

    await expect(stopAllKafkaConsumers(state)).resolves.toBeUndefined();
    expect(state.consumers).toHaveLength(0);
  });

  it("should not throw if a consumer stop/disconnect fails", async () => {
    const handle1 = createMockConsumerHandle("ctag-1");
    (handle1.consumer.stop as Mock).mockRejectedValue(new Error("stop error"));
    const handle2 = createMockConsumerHandle("ctag-2");
    const state = createMockState([handle1, handle2]);

    await expect(stopAllKafkaConsumers(state)).resolves.toBeUndefined();
    expect(state.consumers).toHaveLength(0);
    expect(handle2.consumer.stop).toHaveBeenCalledTimes(1);
    expect(handle2.consumer.disconnect).toHaveBeenCalledTimes(1);
  });

  it("should clear the consumer pool", async () => {
    const state = createMockState([]);
    const mockConsumer = createMockConsumer();
    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a"]),
      callbacks: new Map(),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 1,
    });

    await stopAllKafkaConsumers(state);

    expect(state.consumerPool.size).toBe(0);
  });
});

describe("releasePooledConsumer", () => {
  it("should disconnect consumer when refCount reaches 0", async () => {
    const mockConsumer = createMockConsumer();
    const state = createMockState([]);
    const logger = createMockLogger();

    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a"]),
      callbacks: new Map([["topic-a", [vi.fn()]]]),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 1,
    });

    state.consumers.push({
      consumerTag: "ctag-1",
      groupId: "group-a",
      topic: "topic-a",
      consumer: mockConsumer,
    });

    await releasePooledConsumer({
      state,
      groupId: "group-a",
      topic: "topic-a",
      logger: logger as any,
    });

    expect(state.consumerPool.has("group-a")).toBe(false);
    expect(mockConsumer.stop).toHaveBeenCalledTimes(1);
    expect(mockConsumer.disconnect).toHaveBeenCalledTimes(1);
    expect(state.consumers).toHaveLength(0);
  });

  it("should restart consumer when refCount > 0 after releasing a different topic", async () => {
    const mockConsumer = createMockConsumer();
    const state = createMockState([]);
    const logger = createMockLogger();

    const callbackB = vi.fn();
    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a", "topic-b"]),
      callbacks: new Map([
        ["topic-a", [vi.fn()]],
        ["topic-b", [callbackB]],
      ]),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 2,
    });

    await releasePooledConsumer({
      state,
      groupId: "group-a",
      topic: "topic-a",
      logger: logger as any,
    });

    const pooled = state.consumerPool.get("group-a")!;
    expect(pooled.refCount).toBe(1);
    expect(pooled.topics.has("topic-a")).toBe(false);
    expect(pooled.topics.has("topic-b")).toBe(true);
    expect(pooled.callbacks.has("topic-a")).toBe(false);
    expect(mockConsumer.stop).toHaveBeenCalledTimes(1);
    expect(mockConsumer.subscribe).toHaveBeenCalledWith({
      topic: "topic-b",
      fromBeginning: false,
    });
    expect(mockConsumer.run).toHaveBeenCalledTimes(1);
  });

  it("should remove one callback when multiple callbacks exist for the same topic", async () => {
    const mockConsumer = createMockConsumer();
    const state = createMockState([]);
    const logger = createMockLogger();

    const cb1 = vi.fn();
    const cb2 = vi.fn();
    const cb3 = vi.fn();
    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a"]),
      callbacks: new Map([["topic-a", [cb1, cb2, cb3]]]),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 3,
    });

    await releasePooledConsumer({
      state,
      groupId: "group-a",
      topic: "topic-a",
      logger: logger as any,
    });

    const pooled = state.consumerPool.get("group-a")!;
    expect(pooled.refCount).toBe(2);
    expect(pooled.callbacks.get("topic-a")).toHaveLength(2);
    expect(pooled.topics.has("topic-a")).toBe(true);
  });

  it("should remove the topic entirely when last callback is released", async () => {
    const mockConsumer = createMockConsumer();
    const state = createMockState([]);
    const logger = createMockLogger();

    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a", "topic-b"]),
      callbacks: new Map([
        ["topic-a", [vi.fn()]],
        ["topic-b", [vi.fn()]],
      ]),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 2,
    });

    await releasePooledConsumer({
      state,
      groupId: "group-a",
      topic: "topic-a",
      logger: logger as any,
    });

    const pooled = state.consumerPool.get("group-a")!;
    expect(pooled.refCount).toBe(1);
    expect(pooled.callbacks.has("topic-a")).toBe(false);
    expect(pooled.topics.has("topic-a")).toBe(false);
  });

  it("should be a no-op for unknown groupId", async () => {
    const state = createMockState([]);
    const logger = createMockLogger();

    await expect(
      releasePooledConsumer({
        state,
        groupId: "unknown",
        topic: "topic-a",
        logger: logger as any,
      }),
    ).resolves.toBeUndefined();
  });

  it("should not throw if consumer stop fails during release", async () => {
    const mockConsumer = createMockConsumer();
    (mockConsumer.stop as Mock).mockRejectedValue(new Error("stop error"));
    const state = createMockState([]);
    const logger = createMockLogger();

    state.consumerPool.set("group-a", {
      consumer: mockConsumer,
      groupId: "group-a",
      topics: new Set(["topic-a"]),
      callbacks: new Map([["topic-a", [vi.fn()]]]),
      roundRobinCounters: new Map(),
      localAbort: new AbortController(),
      refCount: 1,
    });

    await expect(
      releasePooledConsumer({
        state,
        groupId: "group-a",
        topic: "topic-a",
        logger: logger as any,
      }),
    ).resolves.toBeUndefined();

    expect(state.consumerPool.has("group-a")).toBe(false);
  });
});
