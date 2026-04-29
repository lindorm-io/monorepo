import type { IMessage, IMessageSubscriber } from "../../../../interfaces/index.js";
import type { IrisConnectionState } from "../../../../types/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { RedisDriver } from "./RedisDriver.js";
import { RedisPublisher } from "./RedisPublisher.js";
import { RedisMessageBus } from "./RedisMessageBus.js";
import { RedisWorkerQueue } from "./RedisWorkerQueue.js";
import { RedisStreamProcessor } from "./RedisStreamProcessor.js";
import { RedisRpcClient } from "./RedisRpcClient.js";
import { RedisRpcServer } from "./RedisRpcServer.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mock ioredis ---
const mockRedisInstance = {
  once: vi.fn(),
  on: vi.fn(),
  ping: vi.fn().mockResolvedValue("PONG"),
  disconnect: vi.fn().mockResolvedValue(undefined),
  duplicate: vi.fn(),
  xadd: vi.fn().mockResolvedValue("1-1"),
  xreadgroup: vi.fn().mockResolvedValue(null),
  xack: vi.fn().mockResolvedValue(1),
  xgroup: vi.fn().mockResolvedValue("OK"),
  del: vi.fn().mockResolvedValue(1),
};

// Simulate 'ready' event immediately
mockRedisInstance.once.mockImplementation((event: string, cb: Function) => {
  if (event === "ready") {
    process.nextTick(() => cb());
  }
  return mockRedisInstance;
});

vi.mock("ioredis", async () => {
  const MockRedis = vi.fn(function () {
    return mockRedisInstance;
  });

  return {
    Redis: MockRedis,
    default: MockRedis,
  };
});

// --- Test message classes ---

@Message({ name: "TckRedisDriverBasic" })
class TckRedisDriverBasic implements IMessage {
  @Field("string") body!: string;
}

@Message({ name: "TckRedisDriverReq" })
class TckRedisDriverReq implements IMessage {
  @Field("string") query!: string;
}

@Message({ name: "TckRedisDriverRes" })
class TckRedisDriverRes implements IMessage {
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

const createDriver = (subscribers?: Array<IMessageSubscriber>) => {
  const subs: Array<IMessageSubscriber> = subscribers ?? [];
  return new RedisDriver({
    logger: createMockLogger() as any,
    getSubscribers: () => subs,
    url: "redis://localhost:6379",
  });
};

// --- Tests ---

describe("RedisDriver", () => {
  beforeEach(() => {
    clearRegistry();
    vi.clearAllMocks();
    // Re-setup the mock for ready event
    mockRedisInstance.once.mockImplementation((event: string, cb: Function) => {
      if (event === "ready") {
        process.nextTick(() => cb());
      }
      return mockRedisInstance;
    });
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

    it("should return true from ping when connected", async () => {
      const driver = createDriver();
      await driver.connect();
      expect(await driver.ping()).toBe(true);
    });

    it("should return false from ping when not connected", async () => {
      const driver = createDriver();
      expect(await driver.ping()).toBe(false);
    });

    it("should setup without error", async () => {
      const driver = createDriver();
      await driver.connect();
      await expect(driver.setup([TckRedisDriverBasic])).resolves.toBeUndefined();
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
      (driver as any).state.createdGroups.add("test-group");

      await driver.reset();

      expect((driver as any).state.createdGroups.size).toBe(0);
      expect((driver as any).state.consumerLoops).toHaveLength(0);
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

      const sub: IMessageSubscriber = { beforePublish: vi.fn() };
      const cloned = driver.cloneWithGetters(() => [sub]) as RedisDriver;
      expect((cloned as any).getSubscribers()).toEqual([sub]);
    });
  });

  describe("factory methods", () => {
    it("should create RedisPublisher via createPublisher", async () => {
      const driver = createDriver();
      await driver.connect();
      const publisher = driver.createPublisher(TckRedisDriverBasic);
      expect(publisher).toBeInstanceOf(RedisPublisher);
    });

    it("should create RedisMessageBus via createMessageBus", async () => {
      const driver = createDriver();
      await driver.connect();
      const bus = driver.createMessageBus(TckRedisDriverBasic);
      expect(bus).toBeInstanceOf(RedisMessageBus);
    });

    it("should create RedisWorkerQueue via createWorkerQueue", async () => {
      const driver = createDriver();
      await driver.connect();
      const queue = driver.createWorkerQueue(TckRedisDriverBasic);
      expect(queue).toBeInstanceOf(RedisWorkerQueue);
    });

    it("should create RedisStreamProcessor via createStreamProcessor", async () => {
      const driver = createDriver();
      await driver.connect();
      const processor = driver.createStreamProcessor();
      expect(processor).toBeInstanceOf(RedisStreamProcessor);
    });

    it("should create RedisRpcClient via createRpcClient", async () => {
      const driver = createDriver();
      await driver.connect();
      const client = driver.createRpcClient(TckRedisDriverReq, TckRedisDriverRes);
      expect(client).toBeInstanceOf(RedisRpcClient);
    });

    it("should create RedisRpcServer via createRpcServer", async () => {
      const driver = createDriver();
      await driver.connect();
      const server = driver.createRpcServer(TckRedisDriverReq, TckRedisDriverRes);
      expect(server).toBeInstanceOf(RedisRpcServer);
    });
  });

  describe("reconnection", () => {
    it("should set state to reconnecting when ioredis emits reconnecting", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      // Find the 'reconnecting' event handler registered via redis.on()
      const reconnectingCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "reconnecting",
      );
      expect(reconnectingCall).toBeDefined();

      // Simulate ioredis reconnecting event
      (reconnectingCall![1] as Function)();

      expect(states).toContain("reconnecting");
      expect(driver.getConnectionState()).toBe("reconnecting");
    });

    it("should set state to connected when ioredis emits ready after reconnect", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      // Simulate reconnecting -> ready sequence
      const reconnectingCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "reconnecting",
      );
      const readyCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "ready",
      );

      expect(reconnectingCall).toBeDefined();
      expect(readyCall).toBeDefined();

      (reconnectingCall![1] as Function)();
      expect(driver.getConnectionState()).toBe("reconnecting");

      (readyCall![1] as Function)();
      expect(driver.getConnectionState()).toBe("connected");
    });

    it("should set state to reconnecting when ioredis emits close unexpectedly", async () => {
      const driver = createDriver();
      await driver.connect();

      const closeCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "close",
      );
      expect(closeCall).toBeDefined();

      (closeCall![1] as Function)();
      expect(driver.getConnectionState()).toBe("reconnecting");
    });

    it("should not set state to reconnecting on deliberate disconnect", async () => {
      const driver = createDriver();
      await driver.connect();

      const closeCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "close",
      );
      expect(closeCall).toBeDefined();

      await driver.disconnect();

      // Simulate a late close event after deliberate disconnect
      (closeCall![1] as Function)();
      expect(driver.getConnectionState()).toBe("disconnected");
    });

    it("should not propagate ready event when deliberately disconnected", async () => {
      const driver = createDriver();
      const states: Array<IrisConnectionState> = [];
      driver.on("connection:state", (s) => states.push(s));

      await driver.connect();

      const readyCall = mockRedisInstance.on.mock.calls.find(
        (c: Array<unknown>) => c[0] === "ready",
      );
      expect(readyCall).toBeDefined();

      await driver.disconnect();
      states.length = 0;

      // Simulate a late ready event
      (readyCall![1] as Function)();
      expect(states).not.toContain("connected");
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
