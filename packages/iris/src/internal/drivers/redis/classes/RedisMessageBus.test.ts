import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types";
import { RedisMessageBus } from "./RedisMessageBus";

// --- Mocks ---
const mockPublishRedisMessages = jest.fn().mockResolvedValue(undefined);
jest.mock("../utils/publish-redis-messages", () => ({
  publishRedisMessages: (...args: Array<unknown>) => mockPublishRedisMessages(...args),
}));

const mockWrapRedisConsumer = jest.fn().mockReturnValue(jest.fn());
jest.mock("../utils/wrap-redis-consumer", () => ({
  wrapRedisConsumer: (...args: Array<unknown>) => mockWrapRedisConsumer(...args),
}));

let mockCreateConsumerLoopResult: Partial<RedisConsumerLoop>;
const mockCreateConsumerLoop = jest
  .fn()
  .mockImplementation(async () => mockCreateConsumerLoopResult);
jest.mock("../utils/create-consumer-loop", () => ({
  createConsumerLoop: (...args: Array<unknown>) => mockCreateConsumerLoop(...args),
}));

// --- Test message ---

@Message({ name: "TckRedisBusBasic" })
class TckRedisBusBasic implements IMessage {
  @Field("string") body!: string;
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

const createMockState = (): RedisSharedState => ({
  publishConnection: {
    xadd: jest.fn(),
    duplicate: jest.fn(),
    disconnect: jest.fn(),
    xgroup: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    xreadgroup: jest.fn(),
    xack: jest.fn(),
    on: jest.fn(),
  } as any,
  connectionConfig: { url: "redis://localhost:6379" },
  prefix: "iris",
  consumerName: "iris:test:1:abcd1234",
  consumerLoops: [],
  consumerRegistrations: [],
  createdGroups: new Set(),
  publishedStreams: new Set(),
  inFlightCount: 0,
  prefetch: 10,
  blockMs: 5000,
  maxStreamLength: null,
});

const createBus = () => {
  const state = createMockState();
  const bus = new RedisMessageBus<TckRedisBusBasic>({
    target: TckRedisBusBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { bus, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishRedisMessages.mockClear();
  mockWrapRedisConsumer.mockClear();
  mockCreateConsumerLoop.mockClear();
  mockCreateConsumerLoopResult = {
    consumerTag: "ctag-1",
    groupName: "test-group",
    streamKey: "iris:TckRedisBusBasic",
    callback: jest.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: jest.fn() } as any,
  };
});

describe("RedisMessageBus", () => {
  describe("publish", () => {
    it("should call publishRedisMessages", async () => {
      const { bus } = createBus();
      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);
      expect(mockPublishRedisMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("subscribe", () => {
    it("should create consumer loop with correct stream key and group", async () => {
      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);
      const loopOpts = mockCreateConsumerLoop.mock.calls[0][0];
      expect(loopOpts.streamKey).toBe("iris:TckRedisBusBasic");
      expect(loopOpts.groupName).toBe("iris.TckRedisBusBasic.q1");
    });

    it("should create ephemeral group when no queue specified", async () => {
      const { bus } = createBus();

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        callback: async () => {},
      });

      expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(1);
      const loopOpts = mockCreateConsumerLoop.mock.calls[0][0];
      expect(loopOpts.groupName).toMatch(/^iris\.sub\.ephemeral\./);
    });

    it("should throw when no connection available", async () => {
      const { bus, state } = createBus();
      state.publishConnection = null;

      await expect(
        bus.subscribe({ topic: "TckRedisBusBasic", callback: async () => {} }),
      ).rejects.toThrow("Cannot subscribe: connection is not available");
    });
  });

  describe("unsubscribe", () => {
    it("should abort the consumer loop", async () => {
      const abortController = new AbortController();
      const disconnectFn = jest.fn().mockResolvedValue(undefined);
      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-2",
        groupName: "test-group",
        streamKey: "iris:TckRedisBusBasic",
        callback: jest.fn(),
        abortController,
        loopPromise: Promise.resolve(),
        connection: { disconnect: disconnectFn } as any,
      };

      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      await bus.unsubscribe({ topic: "TckRedisBusBasic", queue: "q1" });

      expect(abortController.signal.aborted).toBe(true);
      // xgroup DESTROY should NOT be called for named queues
      expect(state.publishConnection!.xgroup).not.toHaveBeenCalledWith(
        "DESTROY",
        expect.any(String),
        expect.any(String),
      );
    });

    it("should destroy ephemeral consumer group on unsubscribe when no queue provided", async () => {
      const abortController = new AbortController();
      const disconnectFn = jest.fn().mockResolvedValue(undefined);
      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-eph",
        groupName: "iris.sub.ephemeral.test-uuid",
        streamKey: "iris:TckRedisBusBasic",
        callback: jest.fn(),
        abortController,
        loopPromise: Promise.resolve(),
        connection: { disconnect: disconnectFn } as any,
      };

      const { bus, state } = createBus();

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        callback: async () => {},
      });

      await bus.unsubscribe({ topic: "TckRedisBusBasic" });

      expect(state.publishConnection!.xgroup).toHaveBeenCalledWith(
        "DESTROY",
        "iris:TckRedisBusBasic",
        expect.stringMatching(/^iris\.sub\.ephemeral\./),
      );
    });
  });

  describe("unsubscribeAll", () => {
    it("should abort all owned consumer loops", async () => {
      const ac1 = new AbortController();
      const dc1 = jest.fn().mockResolvedValue(undefined);
      const ac2 = new AbortController();
      const dc2 = jest.fn().mockResolvedValue(undefined);

      const { bus, state } = createBus();

      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-a",
        groupName: "g1",
        streamKey: "iris:TckRedisBusBasic",
        callback: jest.fn(),
        abortController: ac1,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc1 } as any,
      };

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-b",
        groupName: "g2",
        streamKey: "iris:TckRedisBusBasic",
        callback: jest.fn(),
        abortController: ac2,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc2 } as any,
      };

      await bus.subscribe({
        topic: "TckRedisBusBasic",
        queue: "q2",
        callback: async () => {},
      });

      await bus.unsubscribeAll();

      expect(ac1.signal.aborted).toBe(true);
      expect(ac2.signal.aborted).toBe(true);
      expect(dc1).toHaveBeenCalledTimes(1);
      expect(dc2).toHaveBeenCalledTimes(1);
    });
  });
});
