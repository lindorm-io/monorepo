import type { IMessage } from "../../../../interfaces/index.js";
import { Broadcast } from "../../../../decorators/Broadcast.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { KafkaWorkerQueue } from "./KafkaWorkerQueue.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Mocks ---
const mockPublishKafkaMessages = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/publish-kafka-messages.js", async () => ({
  publishKafkaMessages: (...args: Array<unknown>) => mockPublishKafkaMessages(...args),
}));

const mockWrapKafkaConsumer = vi.fn().mockReturnValue(vi.fn());
vi.mock("../utils/wrap-kafka-consumer.js", () => ({
  wrapKafkaConsumer: (...args: Array<unknown>) => mockWrapKafkaConsumer(...args),
}));

let mockGetOrCreateResult: { consumerTag: string };
const mockGetOrCreatePooledConsumer = vi
  .fn()
  .mockImplementation(async () => mockGetOrCreateResult);
vi.mock("../utils/create-kafka-consumer.js", () => ({
  getOrCreatePooledConsumer: (...args: Array<unknown>) =>
    mockGetOrCreatePooledConsumer(...args),
}));

const mockReleasePooledConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/stop-kafka-consumer.js", () => ({
  releasePooledConsumer: (...args: Array<unknown>) => mockReleasePooledConsumer(...args),
}));

const mockEnsureRetryTopicAttached = vi.fn().mockResolvedValue(undefined);
const mockReleaseRetryConsumer = vi.fn().mockResolvedValue(undefined);
vi.mock("../utils/retry-topic-consumer.js", () => ({
  ensureRetryTopicAttached: (...args: Array<unknown>) =>
    mockEnsureRetryTopicAttached(...args),
  releaseRetryConsumer: (...args: Array<unknown>) => mockReleaseRetryConsumer(...args),
}));

// --- Test message ---

@Message({ name: "TckKafkaWqBasic" })
class TckKafkaWqBasic implements IMessage {
  @Field("string") data!: string;
}

@Broadcast()
@Message({ name: "TckKafkaWqBroadcast" })
class TckKafkaWqBroadcast implements IMessage {
  @Field("string") data!: string;
}

// --- Helpers ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

const createMockState = (): KafkaSharedState => ({
  kafka: {
    producer: vi.fn(),
    consumer: vi.fn(),
    admin: vi.fn(),
  } as any,
  admin: null,
  producer: { send: vi.fn(), connect: vi.fn(), disconnect: vi.fn() } as any,
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

const createQueue = () => {
  const state = createMockState();
  const queue = new KafkaWorkerQueue<TckKafkaWqBasic>({
    target: TckKafkaWqBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { queue, state };
};

const createBroadcastQueue = () => {
  const state = createMockState();
  const queue = new KafkaWorkerQueue<TckKafkaWqBroadcast>({
    target: TckKafkaWqBroadcast as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { queue, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishKafkaMessages.mockClear();
  mockWrapKafkaConsumer.mockClear();
  mockGetOrCreatePooledConsumer.mockClear();
  mockReleasePooledConsumer.mockClear();
  mockEnsureRetryTopicAttached.mockClear();
  mockReleaseRetryConsumer.mockClear();
  mockGetOrCreateResult = {
    consumerTag: "ctag-1",
  };
});

describe("KafkaWorkerQueue", () => {
  describe("publish", () => {
    it("should call publishKafkaMessages", async () => {
      const { queue } = createQueue();
      const msg = queue.create({ data: "test" });
      await queue.publish(msg);
      expect(mockPublishKafkaMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("consume", () => {
    it("should create a single pooled consumer for a non-broadcast type", async () => {
      const { queue } = createQueue();

      await queue.consume("my-queue", async () => {});

      // Non-broadcast worker-queue type: only the competing-consumer (main) pooled
      // consumer is created. No dead broadcast consumer and no auto-created
      // `.broadcast` topic (M14) — nothing is ever published there for a
      // non-broadcast type.
      // The listen topic is derived from the message metadata (so it matches the
      // publish-side resolved topic), while the consumer group derives from the
      // queue identifier.
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(1);
      const mainOpts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
      expect(mainOpts.topic).toBe("iris.TckKafkaWqBasic");
      expect(mainOpts.groupId).toBe("iris.wq.my-queue");

      // No `.broadcast` topic is ever subscribed for a non-broadcast type.
      const subscribedTopics = mockGetOrCreatePooledConsumer.mock.calls.map(
        (c) => c[0].topic,
      );
      expect(subscribedTopics).not.toContain("iris.TckKafkaWqBasic.broadcast");

      // Retry topics attach LAZILY (M1) — on the first actual retry, not at
      // consume time.
      expect(mockEnsureRetryTopicAttached).not.toHaveBeenCalled();
    });

    it("should create main + broadcast pooled consumers for a broadcast type", async () => {
      const { queue } = createBroadcastQueue();

      await queue.consume("my-queue", async () => {});

      // Broadcast type: main (competing consumer) + broadcast consumer.
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
      expect(mainOpts.topic).toBe("iris.TckKafkaWqBroadcast");
      expect(mainOpts.groupId).toBe("iris.wq.my-queue");

      const broadcastOpts = mockGetOrCreatePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.TckKafkaWqBroadcast.broadcast");

      // Retry topics attach lazily (M1) — neither the main nor the broadcast
      // group attaches one at consume time.
      expect(mockEnsureRetryTopicAttached).not.toHaveBeenCalled();
    });

    it("should create a single pooled consumer with options object", async () => {
      const { queue } = createQueue();

      await queue.consume({
        queue: "my-queue",
        callback: async () => {},
      });

      // Non-broadcast: main only
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(1);
    });

    it("should throw when callback is missing", async () => {
      const { queue } = createQueue();
      await expect(queue.consume("my-queue")).rejects.toThrow(
        "consume() requires a callback",
      );
    });

    it("should throw when kafka client is not available", async () => {
      const { queue, state } = createQueue();
      state.kafka = null;

      await expect(queue.consume("my-queue", async () => {})).rejects.toThrow(
        "Cannot consume: Kafka client is not connected",
      );
    });
  });

  describe("unconsume", () => {
    it("should release the pooled consumer for a non-broadcast queue", async () => {
      const { queue } = createQueue();
      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      // Non-broadcast: only the main pooled consumer is released
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(1);
      const mainOpts = mockReleasePooledConsumer.mock.calls[0][0];
      expect(mainOpts.groupId).toBe("iris.wq.my-queue");
      expect(mainOpts.topic).toBe("iris.TckKafkaWqBasic");

      // The main group is checked for a lazily-attached retry consumer to tear
      // down (M1) — no-op here since it never retried.
      expect(mockReleaseRetryConsumer).toHaveBeenCalledTimes(1);
    });

    it("should release main + broadcast pooled consumers for a broadcast queue", async () => {
      const { queue } = createBroadcastQueue();
      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      // Broadcast: main + broadcast pooled consumers are released
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockReleasePooledConsumer.mock.calls[0][0];
      expect(mainOpts.topic).toBe("iris.TckKafkaWqBroadcast");

      const broadcastOpts = mockReleasePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.TckKafkaWqBroadcast.broadcast");

      // Both the main and broadcast groups are checked for a lazily-attached
      // retry consumer to tear down (M1).
      expect(mockReleaseRetryConsumer).toHaveBeenCalledTimes(2);
    });

    it("should be a no-op for unknown queue", async () => {
      const { queue } = createQueue();
      await expect(queue.unconsume("unknown")).resolves.toBeUndefined();
      expect(mockReleasePooledConsumer).not.toHaveBeenCalled();
    });
  });

  describe("unconsumeAll", () => {
    it("should release all owned consumers", async () => {
      const { queue } = createQueue();

      mockGetOrCreateResult = { consumerTag: "ctag-a" };
      await queue.consume("q1", async () => {});

      mockGetOrCreateResult = { consumerTag: "ctag-b" };
      await queue.consume("q2", async () => {});

      await queue.unconsumeAll();

      // 2 non-broadcast queues x 1 consumer each = 2 releases
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(2);
      // 2 non-broadcast queues x 1 group each = 2 retry-consumer teardown checks
      expect(mockReleaseRetryConsumer).toHaveBeenCalledTimes(2);
    });
  });
});
