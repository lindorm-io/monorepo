import type { IMessage, IMessageSubscriber } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import { MemoryDeadLetterStore } from "../../../dead-letter/MemoryDeadLetterStore.js";
import { DelayManager } from "../../../delay/DelayManager.js";
import { MemoryDelayStore } from "../../../delay/MemoryDelayStore.js";
import { createStore } from "../utils/create-store.js";
import { MemoryDriver } from "./MemoryDriver.js";
import { MemoryMessageBus } from "./MemoryMessageBus.js";
import { MemoryPublisher } from "./MemoryPublisher.js";
import { MemoryRpcClient } from "./MemoryRpcClient.js";
import { MemoryRpcServer } from "./MemoryRpcServer.js";
import { MemoryStreamProcessor } from "./MemoryStreamProcessor.js";
import { MemoryWorkerQueue } from "./MemoryWorkerQueue.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckDriverBasic" })
class TckDriverBasic implements IMessage {
  @Field("string") body!: string;
}

@Message({ name: "TckDriverReq" })
class TckDriverReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckDriverRes" })
class TckDriverRes implements IMessage {
  @Field("string") result!: string;
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

const createDriver = (
  subscribers?: Array<IMessageSubscriber>,
  options?: { delayManager?: DelayManager; deadLetterManager?: DeadLetterManager },
) => {
  const subs: Array<IMessageSubscriber> = subscribers ?? [];
  return new MemoryDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => subs,
    delayManager: options?.delayManager,
    deadLetterManager: options?.deadLetterManager,
  });
};

// --- Tests ---

describe("MemoryDriver", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("lifecycle", () => {
    it("should connect successfully", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(driver.connected).toBe(true);
    });

    it("should disconnect and clear subscriptions", async () => {
      const driver = createDriver();
      await driver.connect();

      (driver as any).store.subscriptions.push({
        topic: "test",
        queue: null,
        callback: async () => {},
        consumerTag: "tag-1",
      });

      await driver.disconnect();

      expect(driver.connected).toBe(false);
      expect((driver as any).store.subscriptions).toHaveLength(0);
    });

    it("should disconnect and clear consumers", async () => {
      const driver = createDriver();
      await driver.connect();

      (driver as any).store.consumers.push({
        topic: "test",
        callback: async () => {},
        consumerTag: "tag-1",
      });

      await driver.disconnect();

      expect((driver as any).store.consumers).toHaveLength(0);
    });

    it("should disconnect and clear rpc handlers", async () => {
      const driver = createDriver();
      await driver.connect();

      (driver as any).store.rpcHandlers.push({
        queue: "rpc-queue",
        handler: async (env: any) => env,
      });

      await driver.disconnect();

      expect((driver as any).store.rpcHandlers).toHaveLength(0);
    });

    it("should disconnect and clear timers", async () => {
      const driver = createDriver();
      await driver.connect();

      const timer = setTimeout(() => {}, 99999);
      (driver as any).store.timers.add(timer);

      await driver.disconnect();

      expect((driver as any).store.timers.size).toBe(0);
    });

    it("should clear roundRobinIndexes on disconnect", async () => {
      const driver = createDriver();
      await driver.connect();

      (driver as any).store.roundRobinIndexes.set("key", 5);

      await driver.disconnect();

      expect((driver as any).store.roundRobinIndexes.size).toBe(0);
    });

    it("should return true from ping when connected", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(await driver.ping()).toBe(true);
    });

    it("should return false from ping when not connected", async () => {
      const driver = createDriver();
      expect(await driver.ping()).toBe(false);
    });

    it("should setup without error (no-op)", async () => {
      const driver = createDriver();
      await expect(driver.setup([TckDriverBasic])).resolves.toBeUndefined();
    });

    it("should start delay polling on connect when delayManager provided", async () => {
      const logger = createMockLogger();
      const delayManager = new DelayManager({
        store: new MemoryDelayStore(),
        logger: logger as any,
      });
      const startSpy = vi.spyOn(delayManager, "start");

      const driver = createDriver([], { delayManager });
      await driver.connect();

      expect(startSpy).toHaveBeenCalledTimes(1);

      await driver.disconnect();
      startSpy.mockRestore();
    });

    it("should stop delay polling on disconnect when delayManager provided", async () => {
      const logger = createMockLogger();
      const delayManager = new DelayManager({
        store: new MemoryDelayStore(),
        logger: logger as any,
      });
      const stopSpy = vi.spyOn(delayManager, "stop");

      const driver = createDriver([], { delayManager });
      await driver.connect();
      await driver.disconnect();

      expect(stopSpy).toHaveBeenCalledTimes(1);
      stopSpy.mockRestore();
    });
  });

  describe("connection state listeners", () => {
    it("should notify state listeners on connect", async () => {
      const driver = createDriver();
      const states: Array<string> = [];
      driver.on("connection:state", (state) => states.push(state));

      await driver.connect();

      expect(states).toEqual(["connecting", "connected"]);
    });

    it("should propagate listener errors through EventEmitter", async () => {
      const driver = createDriver();

      driver.on("connection:state", () => {
        throw new Error("listener boom");
      });

      await expect(driver.connect()).rejects.toThrow("listener boom");
    });
  });

  describe("cloneWithGetters", () => {
    it("should share the same store instance", () => {
      const driver = createDriver();
      const newSubs: Array<IMessageSubscriber> = [];
      const cloned = driver.cloneWithGetters(() => newSubs);

      expect((cloned as any).store).toBe((driver as any).store);
    });

    it("should use the provided getSubscribers function", () => {
      const driver = createDriver();
      const sub: IMessageSubscriber = { beforePublish: vi.fn() };
      const cloned = driver.cloneWithGetters(() => [sub]);

      expect((cloned as any).getSubscribers()).toEqual([sub]);
    });

    it("should share delayManager and deadLetterManager with clone", () => {
      const logger = createMockLogger();
      const delayManager = new DelayManager({
        store: new MemoryDelayStore(),
        logger: logger as any,
      });
      const deadLetterManager = new DeadLetterManager({
        store: new MemoryDeadLetterStore(),
        logger: logger as any,
      });

      const driver = createDriver([], { delayManager, deadLetterManager });
      const cloned = driver.cloneWithGetters(() => []);

      expect((cloned as any).delayManager).toBe(delayManager);
      expect((cloned as any).deadLetterManager).toBe(deadLetterManager);
    });
  });

  describe("getDeadLetters", () => {
    it("should return empty array when no deadLetterManager", async () => {
      const driver = createDriver();
      expect(await driver.getDeadLetters()).toEqual([]);
    });

    it("should return empty array when deadLetterManager has no entries", async () => {
      const logger = createMockLogger();
      const deadLetterManager = new DeadLetterManager({
        store: new MemoryDeadLetterStore(),
        logger: logger as any,
      });

      const driver = createDriver([], { deadLetterManager });
      expect(await driver.getDeadLetters()).toEqual([]);
    });

    it("should return dead letters from manager", async () => {
      const logger = createMockLogger();
      const deadLetterManager = new DeadLetterManager({
        store: new MemoryDeadLetterStore(),
        logger: logger as any,
      });

      const driver = createDriver([], { deadLetterManager });

      const envelope = {
        payload: Buffer.from("x"),
        headers: {},
        topic: "topic-a",
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 0,
        retryStrategy: "constant" as const,
        retryDelay: 1000,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      };

      await deadLetterManager.send(envelope, "topic-a", new Error("fail-a"));
      await deadLetterManager.send(envelope, "topic-b", new Error("fail-b"));

      const all = await driver.getDeadLetters();
      expect(all).toHaveLength(2);
    });

    it("should filter by topic", async () => {
      const logger = createMockLogger();
      const deadLetterManager = new DeadLetterManager({
        store: new MemoryDeadLetterStore(),
        logger: logger as any,
      });

      const driver = createDriver([], { deadLetterManager });

      const envelope = {
        payload: Buffer.from("x"),
        headers: {},
        topic: "topic-a",
        priority: 0,
        timestamp: Date.now(),
        expiry: null,
        broadcast: false,
        attempt: 0,
        maxRetries: 0,
        retryStrategy: "constant" as const,
        retryDelay: 1000,
        retryDelayMax: 30000,
        retryMultiplier: 2,
        retryJitter: false,
        replyTo: null,
        correlationId: null,
        identifierValue: null,
      };

      await deadLetterManager.send(envelope, "topic-a", new Error("fail-a"));
      await deadLetterManager.send(
        { ...envelope, topic: "topic-b" },
        "topic-b",
        new Error("fail-b"),
      );
      await deadLetterManager.send(envelope, "topic-a", new Error("fail-a2"));

      const filtered = await driver.getDeadLetters("topic-a");
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.topic === "topic-a")).toBe(true);
    });
  });

  describe("factory methods", () => {
    it("should create MemoryPublisher via createPublisher", () => {
      const driver = createDriver();
      const publisher = driver.createPublisher(TckDriverBasic);
      expect(publisher).toBeInstanceOf(MemoryPublisher);
    });

    it("should create MemoryMessageBus via createMessageBus", () => {
      const driver = createDriver();
      const bus = driver.createMessageBus(TckDriverBasic);
      expect(bus).toBeInstanceOf(MemoryMessageBus);
    });

    it("should create MemoryWorkerQueue via createWorkerQueue", () => {
      const driver = createDriver();
      const queue = driver.createWorkerQueue(TckDriverBasic);
      expect(queue).toBeInstanceOf(MemoryWorkerQueue);
    });

    it("should create MemoryStreamProcessor via createStreamProcessor", () => {
      const driver = createDriver();
      const processor = driver.createStreamProcessor();
      expect(processor).toBeInstanceOf(MemoryStreamProcessor);
    });

    it("should create MemoryRpcClient via createRpcClient", () => {
      const driver = createDriver();
      const client = driver.createRpcClient(TckDriverReq, TckDriverRes);
      expect(client).toBeInstanceOf(MemoryRpcClient);
    });

    it("should create MemoryRpcServer via createRpcServer", () => {
      const driver = createDriver();
      const server = driver.createRpcServer(TckDriverReq, TckDriverRes);
      expect(server).toBeInstanceOf(MemoryRpcServer);
    });
  });
});
