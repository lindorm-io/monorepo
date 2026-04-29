import type { IMessage } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { KafkaMessageBus } from "./KafkaMessageBus.js";
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

@Message({ name: "TckKafkaBusBasic" })
class TckKafkaBusBasic implements IMessage {
  @Field("string") body!: string;
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

const createBus = () => {
  const state = createMockState();
  const bus = new KafkaMessageBus<TckKafkaBusBasic>({
    target: TckKafkaBusBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { bus, state };
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

describe("KafkaMessageBus", () => {
  describe("publish", () => {
    it("should call publishKafkaMessages", async () => {
      const { bus } = createBus();
      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);
      expect(mockPublishKafkaMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe", () => {
    it("should create pooled consumer with correct topic and group", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckKafkaBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      // Creates 2 pooled consumers: main + broadcast
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
      expect(mainOpts.topic).toBe("iris.TckKafkaBusBasic");
      expect(mainOpts.groupId).toBe("iris.TckKafkaBusBasic.q1");

      const broadcastOpts = mockGetOrCreatePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.TckKafkaBusBasic.broadcast");
    });

    it("should create ephemeral group when no queue specified", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckKafkaBusBasic",
        callback: async () => {},
      });

      // Creates 2 pooled consumers: main + broadcast
      expect(mockGetOrCreatePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockGetOrCreatePooledConsumer.mock.calls[0][0];
      expect(mainOpts.groupId).toMatch(/^iris\.sub\.ephemeral\./);
    });

    it("should throw when kafka client is not available", async () => {
      const { bus, state } = createBus();
      state.kafka = null;

      await expect(
        bus.subscribe({ topic: "TckKafkaBusBasic", callback: async () => {} }),
      ).rejects.toThrow("Cannot subscribe: Kafka client is not connected");
    });
  });

  describe("unsubscribe", () => {
    it("should release the pooled consumer", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckKafkaBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      await bus.unsubscribe({ topic: "TckKafkaBusBasic", queue: "q1" });

      // Releases 2 pooled consumers: main + broadcast
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(2);
      const mainOpts = mockReleasePooledConsumer.mock.calls[0][0];
      expect(mainOpts.groupId).toBe("iris.TckKafkaBusBasic.q1");
      expect(mainOpts.topic).toBe("iris.TckKafkaBusBasic");

      const broadcastOpts = mockReleasePooledConsumer.mock.calls[1][0];
      expect(broadcastOpts.topic).toBe("iris.TckKafkaBusBasic.broadcast");
    });

    it("should be a no-op for unknown subscription", async () => {
      const { bus } = createBus();
      await expect(bus.unsubscribe({ topic: "unknown" })).resolves.toBeUndefined();
      expect(mockReleasePooledConsumer).not.toHaveBeenCalled();
    });
  });

  describe("unsubscribeAll", () => {
    it("should release all owned consumers", async () => {
      const { bus } = createBus();

      mockGetOrCreateResult = { consumerTag: "ctag-a" };
      await bus.subscribe({
        topic: "TckKafkaBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      mockGetOrCreateResult = { consumerTag: "ctag-b" };
      await bus.subscribe({
        topic: "TckKafkaBusBasic",
        queue: "q2",
        callback: async () => {},
      });

      await bus.unsubscribeAll();

      // 2 subscriptions x 2 consumers each (main + broadcast) = 4 releases
      expect(mockReleasePooledConsumer).toHaveBeenCalledTimes(4);
    });
  });
});
