import type { IMessage, IMessageSubscriber } from "../../../../interfaces";
import type { IrisConnectionState } from "../../../../types";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { KafkaSharedState } from "../types/kafka-types";
import { KafkaDriver } from "./KafkaDriver";
import { KafkaPublisher } from "./KafkaPublisher";
import { KafkaMessageBus } from "./KafkaMessageBus";
import { KafkaWorkerQueue } from "./KafkaWorkerQueue";
import { KafkaStreamProcessor } from "./KafkaStreamProcessor";
import { KafkaRpcClient } from "./KafkaRpcClient";
import { KafkaRpcServer } from "./KafkaRpcServer";

// --- Mock kafkajs ---
const producerEventListeners: Map<string, Array<(payload: unknown) => void>> = new Map();

const mockProducerInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  send: jest.fn().mockResolvedValue(undefined),
  on: jest
    .fn()
    .mockImplementation((event: string, listener: (payload: unknown) => void) => {
      if (!producerEventListeners.has(event)) {
        producerEventListeners.set(event, []);
      }
      producerEventListeners.get(event)!.push(listener);
      return () => {
        const listeners = producerEventListeners.get(event);
        if (listeners) {
          const idx = listeners.indexOf(listener);
          if (idx >= 0) listeners.splice(idx, 1);
        }
      };
    }),
  events: {
    CONNECT: "producer.connect",
    DISCONNECT: "producer.disconnect",
  },
};

const mockAdminInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  listTopics: jest.fn().mockResolvedValue([]),
  createTopics: jest.fn().mockResolvedValue(true),
};

const mockConsumerInstance = {
  connect: jest.fn().mockResolvedValue(undefined),
  disconnect: jest.fn().mockResolvedValue(undefined),
  subscribe: jest.fn().mockResolvedValue(undefined),
  run: jest.fn().mockResolvedValue(undefined),
  pause: jest.fn(),
  resume: jest.fn(),
  stop: jest.fn().mockResolvedValue(undefined),
  commitOffsets: jest.fn().mockResolvedValue(undefined),
};

jest.mock("kafkajs", () => ({
  Kafka: jest.fn().mockImplementation(() => ({
    producer: () => mockProducerInstance,
    consumer: () => mockConsumerInstance,
    admin: () => mockAdminInstance,
  })),
  logLevel: { NOTHING: 0, ERROR: 1, WARN: 2, INFO: 4, DEBUG: 5 },
}));

// --- Test message classes ---

@Message({ name: "TckKafkaDriverBasic" })
class TckKafkaDriverBasic implements IMessage {
  @Field("string") body!: string;
}

@Message({ name: "TckKafkaDriverReq" })
class TckKafkaDriverReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckKafkaDriverRes" })
class TckKafkaDriverRes implements IMessage {
  @Field("string") result!: string;
}

// --- Helpers ---

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

const createDriver = (subscribers?: Array<IMessageSubscriber>) => {
  const subs: Array<IMessageSubscriber> = subscribers ?? [];
  return new KafkaDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => subs,
    brokers: ["localhost:9092"],
  });
};

// --- Tests ---

describe("KafkaDriver", () => {
  beforeEach(() => {
    clearRegistry();
    jest.clearAllMocks();
    producerEventListeners.clear();
  });

  describe("lifecycle", () => {
    it("should connect successfully", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(driver.connected).toBe(true);
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should disconnect", async () => {
      const driver = createDriver();
      await driver.connect();
      await driver.disconnect();
      expect(driver.connected).toBe(false);
      expect(driver.getConnectionState()).toBe("disconnected");
    });

    it("should return true from ping when cached admin connect succeeds", async () => {
      const driver = createDriver();
      await driver.connect();
      // Reset call count from connect() setup
      mockAdminInstance.connect.mockClear();
      expect(await driver.ping()).toBe(true);
      expect(mockAdminInstance.connect).toHaveBeenCalledTimes(1);
    });

    it("should return false from ping when cached admin connect throws", async () => {
      const driver = createDriver();
      await driver.connect();
      mockAdminInstance.connect.mockRejectedValueOnce(new Error("Broker unreachable"));
      expect(await driver.ping()).toBe(false);
    });

    it("should return false from ping when not connected", async () => {
      const driver = createDriver();
      expect(await driver.ping()).toBe(false);
    });

    it("should disconnect cached admin on disconnect", async () => {
      const driver = createDriver();
      await driver.connect();
      mockAdminInstance.disconnect.mockClear();
      await driver.disconnect();
      expect(mockAdminInstance.disconnect).toHaveBeenCalledTimes(1);
    });

    it("should setup without error", async () => {
      const driver = createDriver();
      await driver.connect();
      await expect(driver.setup([TckKafkaDriverBasic])).resolves.toBeUndefined();
    });

    it("should create topics during setup", async () => {
      const driver = createDriver();
      await driver.connect();
      await driver.setup([TckKafkaDriverBasic]);

      expect(mockAdminInstance.createTopics).toHaveBeenCalledTimes(1);
      const createOpts = mockAdminInstance.createTopics.mock.calls[0][0];
      expect(createOpts.topics).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ topic: "iris.TckKafkaDriverBasic" }),
        ]),
      );
    });

    it("should drain successfully", async () => {
      const driver = createDriver();
      await driver.connect();
      await expect(driver.drain(100)).resolves.toBeUndefined();
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should reset state", async () => {
      const driver = createDriver();
      await driver.connect();
      (driver as any).state.createdTopics.add("test-topic");

      await driver.reset();

      // createdTopics is intentionally preserved across reset to avoid re-creating existing topics
      expect((driver as any).state.createdTopics.size).toBe(1);
      expect((driver as any).state.consumers).toHaveLength(0);
      expect((driver as any).state.consumerPool.size).toBe(0);
    });
  });

  describe("state listeners", () => {
    it("should notify listeners on state change", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      expect(states).toContain("connecting");
      expect(states).toContain("connected");
    });
  });

  describe("cloneWithGetters", () => {
    it("should share the same state instance", async () => {
      const driver = createDriver();
      await driver.connect();

      const cloned = driver.cloneWithGetters(() => []);
      expect((cloned as any).state).toBe((driver as any).state);
    });

    it("should use the provided getSubscribers function", async () => {
      const driver = createDriver();
      await driver.connect();

      const sub: IMessageSubscriber = { beforePublish: jest.fn() };
      const cloned = driver.cloneWithGetters(() => [sub]) as KafkaDriver;
      expect((cloned as any).getSubscribers()).toEqual([sub]);
    });
  });

  describe("factory methods", () => {
    it("should create KafkaPublisher via createPublisher", async () => {
      const driver = createDriver();
      await driver.connect();
      const publisher = driver.createPublisher(TckKafkaDriverBasic);
      expect(publisher).toBeInstanceOf(KafkaPublisher);
    });

    it("should create KafkaMessageBus via createMessageBus", async () => {
      const driver = createDriver();
      await driver.connect();
      const bus = driver.createMessageBus(TckKafkaDriverBasic);
      expect(bus).toBeInstanceOf(KafkaMessageBus);
    });

    it("should create KafkaWorkerQueue via createWorkerQueue", async () => {
      const driver = createDriver();
      await driver.connect();
      const queue = driver.createWorkerQueue(TckKafkaDriverBasic);
      expect(queue).toBeInstanceOf(KafkaWorkerQueue);
    });

    it("should create KafkaStreamProcessor via createStreamProcessor", async () => {
      const driver = createDriver();
      await driver.connect();
      const processor = driver.createStreamProcessor();
      expect(processor).toBeInstanceOf(KafkaStreamProcessor);
    });

    it("should create KafkaRpcClient via createRpcClient", async () => {
      const driver = createDriver();
      await driver.connect();
      const client = driver.createRpcClient(TckKafkaDriverReq, TckKafkaDriverRes);
      expect(client).toBeInstanceOf(KafkaRpcClient);
    });

    it("should create KafkaRpcServer via createRpcServer", async () => {
      const driver = createDriver();
      await driver.connect();
      const server = driver.createRpcServer(TckKafkaDriverReq, TckKafkaDriverRes);
      expect(server).toBeInstanceOf(KafkaRpcServer);
    });
  });

  describe("connection config passthrough", () => {
    it("should pass full connection config to Kafka constructor", async () => {
      const { Kafka } = jest.requireMock("kafkajs");

      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["broker1:9092", "broker2:9092"],
        connection: {
          clientId: "my-client",
          ssl: true,
          sasl: { mechanism: "plain", username: "user", password: "pass" },
          connectionTimeout: 5000,
          requestTimeout: 30000,
        },
      });

      await driver.connect();

      expect(Kafka).toHaveBeenCalledWith(
        expect.objectContaining({
          brokers: ["broker1:9092", "broker2:9092"],
          clientId: "my-client",
          ssl: true,
          sasl: { mechanism: "plain", username: "user", password: "pass" },
          connectionTimeout: 5000,
          requestTimeout: 30000,
          logLevel: 0,
        }),
      );
    });

    it("should use prefix as default clientId when not provided", async () => {
      const { Kafka } = jest.requireMock("kafkajs");

      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["localhost:9092"],
        prefix: "my-app",
      });

      await driver.connect();

      expect(Kafka).toHaveBeenCalledWith(
        expect.objectContaining({
          clientId: "my-app",
          brokers: ["localhost:9092"],
        }),
      );
    });
  });

  describe("acks option", () => {
    it("should default acks to -1", async () => {
      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["localhost:9092"],
      });

      expect((driver as any).state.acks).toBe(-1);
    });

    it("should store custom acks value", async () => {
      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["localhost:9092"],
        acks: 1,
      });

      expect((driver as any).state.acks).toBe(1);
    });

    it("should store acks 0", async () => {
      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["localhost:9092"],
        acks: 0,
      });

      expect((driver as any).state.acks).toBe(0);
    });

    it("should preserve acks in cloneWithGetters", async () => {
      const driver = new KafkaDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        brokers: ["localhost:9092"],
        acks: 1,
      });

      await driver.connect();
      const cloned = driver.cloneWithGetters(() => []);
      expect((cloned as any).state.acks).toBe(1);
    });
  });

  describe("reconnection", () => {
    it("should set state to reconnecting when producer emits disconnect", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      // Simulate producer disconnect event
      const disconnectListeners = producerEventListeners.get("producer.disconnect") ?? [];
      expect(disconnectListeners.length).toBeGreaterThan(0);

      for (const listener of disconnectListeners) {
        listener({});
      }

      expect(states).toContain("reconnecting");
      expect(driver.getConnectionState()).toBe("reconnecting");
    });

    it("should set state to connected when producer emits connect after disconnect", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      // Simulate disconnect -> reconnect sequence
      const disconnectListeners = producerEventListeners.get("producer.disconnect") ?? [];
      for (const listener of disconnectListeners) {
        listener({});
      }
      expect(driver.getConnectionState()).toBe("reconnecting");

      const connectListeners = producerEventListeners.get("producer.connect") ?? [];
      for (const listener of connectListeners) {
        listener({});
      }
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should not set state to reconnecting on deliberate disconnect", async () => {
      const driver = createDriver();
      await driver.connect();

      const disconnectListeners = [
        ...(producerEventListeners.get("producer.disconnect") ?? []),
      ];

      await driver.disconnect();

      // Simulate a late producer disconnect event
      for (const listener of disconnectListeners) {
        listener({});
      }

      expect(driver.getConnectionState()).toBe("disconnected");
    });

    it("should unsubscribe producer event listeners on disconnect", async () => {
      const driver = createDriver();
      await driver.connect();

      expect(mockProducerInstance.on).toHaveBeenCalledTimes(2);
      expect(mockProducerInstance.on).toHaveBeenCalledWith(
        "producer.disconnect",
        expect.any(Function),
      );
      expect(mockProducerInstance.on).toHaveBeenCalledWith(
        "producer.connect",
        expect.any(Function),
      );

      await driver.disconnect();

      // After disconnect, event listeners should be cleared
      expect(producerEventListeners.get("producer.disconnect") ?? []).toHaveLength(0);
      expect(producerEventListeners.get("producer.connect") ?? []).toHaveLength(0);
    });

    it("should not transition to connected from connect event when not reconnecting", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();
      states.length = 0;

      // Simulate connect event without prior disconnect — should be no-op
      const connectListeners = producerEventListeners.get("producer.connect") ?? [];
      for (const listener of connectListeners) {
        listener({});
      }

      // Should not have added another "connected" state
      expect(states).toHaveLength(0);
    });
  });

  describe("reply queue", () => {
    it("should track reply queue state", async () => {
      const driver = createDriver();
      await driver.connect();

      expect(driver.replyQueueActive).toBe(false);

      await driver.setupReplyQueue();
      expect(driver.replyQueueActive).toBe(true);

      await driver.teardownReplyQueue();
      expect(driver.replyQueueActive).toBe(false);
    });
  });
});
