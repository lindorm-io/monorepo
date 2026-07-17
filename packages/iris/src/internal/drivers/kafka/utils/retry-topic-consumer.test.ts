import type {
  KafkaConsumerHandle,
  KafkaEachMessagePayload,
  KafkaSharedState,
} from "../types/kafka-types.js";
import {
  ensureRetryTopicAttached,
  releaseRetryConsumer,
} from "./retry-topic-consumer.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mockCreateKafkaConsumer = vi.fn();
vi.mock("./create-kafka-consumer.js", () => ({
  createKafkaConsumer: (...args: Array<unknown>) => mockCreateKafkaConsumer(...args),
}));

const mockEnsureKafkaTopicFromState = vi.fn().mockResolvedValue(undefined);
vi.mock("./ensure-kafka-topic.js", () => ({
  ensureKafkaTopicFromState: (...args: Array<unknown>) =>
    mockEnsureKafkaTopicFromState(...args),
}));

const mockDeleteKafkaTopicFromState = vi.fn().mockResolvedValue(undefined);
vi.mock("./delete-kafka-topic.js", () => ({
  deleteKafkaTopicFromState: (...args: Array<unknown>) =>
    mockDeleteKafkaTopicFromState(...args),
}));

const mockStopKafkaConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("./stop-kafka-consumer.js", () => ({
  stopKafkaConsumer: (...args: Array<unknown>) => mockStopKafkaConsumer(...args),
}));

const createMockLogger = () =>
  ({
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    silly: vi.fn(),
    verbose: vi.fn(),
  }) as any;

const createState = (): KafkaSharedState =>
  ({
    kafka: { consumer: vi.fn(), admin: vi.fn(), producer: vi.fn() } as any,
    prefix: "iris",
    consumers: [],
    consumerRegistrations: [],
    retryConsumers: new Map(),
    createdTopics: new Set(),
    sessionTimeoutMs: 30000,
    prefetch: 10,
    abortController: new AbortController(),
  }) as unknown as KafkaSharedState;

const onMessage = async (_payload: KafkaEachMessagePayload): Promise<void> => {};

beforeEach(() => {
  mockCreateKafkaConsumer.mockReset();
  mockCreateKafkaConsumer.mockImplementation(
    async (opts: { groupId: string; topic: string }): Promise<KafkaConsumerHandle> => ({
      consumerTag: "retry-ctag",
      groupId: opts.groupId,
      topic: opts.topic,
      consumer: {} as any,
    }),
  );
  mockEnsureKafkaTopicFromState.mockClear();
  mockDeleteKafkaTopicFromState.mockClear();
  mockStopKafkaConsumer.mockClear();
});

describe("ensureRetryTopicAttached", () => {
  it("ensures the retry topic and joins a dedicated consumer on its own group", async () => {
    const state = createState();
    const logger = createMockLogger();

    await ensureRetryTopicAttached({
      state,
      groupId: "iris.sub.Orders.q1",
      retryTopic: "iris.Orders.retry.iris.sub.Orders.q1",
      onMessage,
      logger,
    });

    // Topic is created up front so it exists before the first retry is produced.
    expect(mockEnsureKafkaTopicFromState).toHaveBeenCalledWith(
      state,
      "iris.Orders.retry.iris.sub.Orders.q1",
      logger,
    );

    // A dedicated consumer on a FRESH group (`<groupId>.retry`) reads the retry
    // topic — never the delivery consumer, so attaching never stops the
    // in-flight consumer.
    const opts = mockCreateKafkaConsumer.mock.calls[0][0];
    expect(opts.groupId).toBe("iris.sub.Orders.q1.retry");
    expect(opts.topic).toBe("iris.Orders.retry.iris.sub.Orders.q1");
    expect(opts.onMessage).toBe(onMessage);
    expect(opts.fromBeginning).toBe(false);

    // Registered so reconnect rebuilds it, and tracked for teardown.
    expect(state.consumerRegistrations).toEqual([
      {
        consumerTag: "retry-ctag",
        groupId: "iris.sub.Orders.q1.retry",
        topic: "iris.Orders.retry.iris.sub.Orders.q1",
        onMessage,
        pooled: false,
        fromBeginning: false,
      },
    ]);
    expect(state.consumers).toHaveLength(1);
    expect(
      state.retryConsumers.get("iris.Orders.retry.iris.sub.Orders.q1"),
    ).toMatchObject({ groupId: "iris.sub.Orders.q1.retry", consumerTag: "retry-ctag" });
  });

  it("is memoized: a second call for the same retry topic does not re-attach", async () => {
    const state = createState();
    const logger = createMockLogger();

    await ensureRetryTopicAttached({
      state,
      groupId: "g",
      retryTopic: "iris.T.retry.g",
      onMessage,
      logger,
    });
    await ensureRetryTopicAttached({
      state,
      groupId: "g",
      retryTopic: "iris.T.retry.g",
      onMessage,
      logger,
    });

    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);
    expect(state.consumerRegistrations).toHaveLength(1);
  });

  it("dedupes concurrent first-retry attaches onto a single consumer", async () => {
    const state = createState();
    const logger = createMockLogger();

    await Promise.all([
      ensureRetryTopicAttached({
        state,
        groupId: "g",
        retryTopic: "iris.T.retry.g",
        onMessage,
        logger,
      }),
      ensureRetryTopicAttached({
        state,
        groupId: "g",
        retryTopic: "iris.T.retry.g",
        onMessage,
        logger,
      }),
    ]);

    expect(mockCreateKafkaConsumer).toHaveBeenCalledTimes(1);
  });

  it("drops the memo when the attach fails so a later retry can retry it", async () => {
    const state = createState();
    mockCreateKafkaConsumer.mockRejectedValueOnce(new Error("join failed"));

    await expect(
      ensureRetryTopicAttached({
        state,
        groupId: "g",
        retryTopic: "iris.T.retry.g",
        onMessage,
        logger: createMockLogger(),
      }),
    ).rejects.toThrow("join failed");

    expect(state.retryConsumers.has("iris.T.retry.g")).toBe(false);

    // A later retry attaches cleanly.
    await ensureRetryTopicAttached({
      state,
      groupId: "g",
      retryTopic: "iris.T.retry.g",
      onMessage,
      logger: createMockLogger(),
    });
    expect(state.retryConsumers.has("iris.T.retry.g")).toBe(true);
  });
});

describe("releaseRetryConsumer", () => {
  it("stops the consumer, drops the registration, deletes the topic, and clears the memo", async () => {
    const state = createState();
    const logger = createMockLogger();

    await ensureRetryTopicAttached({
      state,
      groupId: "iris.sub.Orders.q1",
      retryTopic: "iris.Orders.retry.iris.sub.Orders.q1",
      onMessage,
      logger,
    });

    await releaseRetryConsumer(state, "iris.Orders.retry.iris.sub.Orders.q1", logger);

    expect(mockStopKafkaConsumer).toHaveBeenCalledWith(state, "retry-ctag");
    expect(state.consumerRegistrations).toHaveLength(0);
    expect(mockDeleteKafkaTopicFromState).toHaveBeenCalledWith(
      state,
      "iris.Orders.retry.iris.sub.Orders.q1",
      logger,
    );
    expect(state.retryConsumers.has("iris.Orders.retry.iris.sub.Orders.q1")).toBe(false);
  });

  it("is a no-op when the group never attached a retry consumer", async () => {
    const state = createState();

    await releaseRetryConsumer(state, "iris.Never.retry.g", createMockLogger());

    expect(mockStopKafkaConsumer).not.toHaveBeenCalled();
    expect(mockDeleteKafkaTopicFromState).not.toHaveBeenCalled();
  });

  it("leaves unrelated registrations intact", async () => {
    const state = createState();
    const otherReg = {
      consumerTag: "other-ctag",
      groupId: "iris.sub.Other.q1",
      topic: "iris.Other",
      onMessage,
      pooled: true as const,
      fromBeginning: false,
    };
    state.consumerRegistrations.push(otherReg);

    await ensureRetryTopicAttached({
      state,
      groupId: "iris.sub.Orders.q1",
      retryTopic: "iris.Orders.retry.iris.sub.Orders.q1",
      onMessage,
      logger: createMockLogger(),
    });

    await releaseRetryConsumer(
      state,
      "iris.Orders.retry.iris.sub.Orders.q1",
      createMockLogger(),
    );

    expect(state.consumerRegistrations).toEqual([otherReg]);
  });
});
