import type { IMessage } from "../../../../interfaces/index.js";
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

// --- Test message ---

@Message({ name: "TckKafkaWqBasic" })
class TckKafkaWqBasic implements IMessage {
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

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishKafkaMessages.mockClear();
  mockWrapKafkaConsumer.mockClear();
  mockGetOrCreatePooledConsumer.mockClear();
  mockReleasePooledConsumer.mockClear();
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
    it("should create pooled consumer with string queue argument", async () => {
      const { queue } = createQueue();

      await queue.consume("my-queue", async () => {});

      // Creates 2 pooled consumers: main + broadcast
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
      expect(mainOpts.topic).toBe("iris.my-queue");
      expect(mainOpts.groupId).toBe("iris.wq.my-queue");

      const broadcastOpts = mockGetOrCreatePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.my-queue.broadcast");
    });

    it("should create pooled consumer with options object", async () => {
      const { queue } = createQueue();

      await queue.consume({
        queue: "my-queue",
        callback: async () => {},
      });

      // Creates 2 pooled consumers: main + broadcast
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(2);
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
    it("should release pooled consumer for specified queue", async () => {
      const { queue } = createQueue();
      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      // Releases 2 pooled consumers: main + broadcast
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockReleasePooledConsumer.mock.calls[0][0];
      expect(mainOpts.groupId).toBe("iris.wq.my-queue");
      expect(mainOpts.topic).toBe("iris.my-queue");

      const broadcastOpts = mockReleasePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.my-queue.broadcast");
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

      // 2 queues x 2 consumers each (main + broadcast) = 4 releases
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(4);
    });
  });
});
