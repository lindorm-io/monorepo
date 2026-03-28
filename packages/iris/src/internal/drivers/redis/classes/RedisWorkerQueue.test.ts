import type { IMessage } from "../../../../interfaces";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { clearRegistry } from "../../../message/metadata/registry";
import type { RedisSharedState, RedisConsumerLoop } from "../types/redis-types";
import { RedisWorkerQueue } from "./RedisWorkerQueue";

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

@Message({ name: "TckRedisWqBasic" })
class TckRedisWqBasic implements IMessage {
  @Field("string") data!: string;
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
    xgroup: jest.fn(),
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

const createQueue = () => {
  const state = createMockState();
  const queue = new RedisWorkerQueue<TckRedisWqBasic>({
    target: TckRedisWqBasic as any,
    logger: createMockLogger() as any,
    getSubscribers: () => [],
    state,
  });
  return { queue, state };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  mockPublishRedisMessages.mockClear();
  mockWrapRedisConsumer.mockClear();
  mockCreateConsumerLoop.mockClear();
  mockCreateConsumerLoopResult = {
    consumerTag: "ctag-1",
    groupName: "iris.wq.my-queue",
    streamKey: "iris:my-queue",
    callback: jest.fn(),
    abortController: new AbortController(),
    loopPromise: Promise.resolve(),
    connection: { disconnect: jest.fn() } as any,
  };
});

describe("RedisWorkerQueue", () => {
  describe("publish", () => {
    it("should call publishRedisMessages", async () => {
      const { queue } = createQueue();
      const msg = queue.create({ data: "test" });
      await queue.publish(msg);
      expect(mockPublishRedisMessages).toHaveBeenCalledTimes(1);
    });
  });

  describe("consume", () => {
    it("should create consumer loop with string queue argument", async () => {
      const { queue } = createQueue();

      await queue.consume("my-queue", async () => {});

      // Creates 2 loops: main (competing consumer) + broadcast
      expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(2);
      const mainOpts = mockCreateConsumerLoop.mock.calls[0][0];
      expect(mainOpts.streamKey).toBe("iris:my-queue");
      expect(mainOpts.groupName).toBe("iris.wq.my-queue");

      const broadcastOpts = mockCreateConsumerLoop.mock.calls[1][0];
      expect(broadcastOpts.streamKey).toBe("iris:my-queue:broadcast");
      expect(broadcastOpts.groupName).toContain("iris.wq.my-queue.bc.");
    });

    it("should create consumer loop with options object", async () => {
      const { queue } = createQueue();

      await queue.consume({
        queue: "my-queue",
        callback: async () => {},
      });

      // Creates 2 loops: main + broadcast
      expect(mockCreateConsumerLoop).toHaveBeenCalledTimes(2);
    });

    it("should throw when callback is missing", async () => {
      const { queue } = createQueue();
      await expect(queue.consume("my-queue")).rejects.toThrow(
        "consume() requires a callback",
      );
    });

    it("should throw when connection is not available", async () => {
      const { queue, state } = createQueue();
      state.publishConnection = null;

      await expect(queue.consume("my-queue", async () => {})).rejects.toThrow(
        "Cannot consume: connection is not available",
      );
    });
  });

  describe("unconsume", () => {
    it("should abort consumer loop for specified queue", async () => {
      const ac = new AbortController();
      const dc = jest.fn().mockResolvedValue(undefined);
      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-wq",
        groupName: "iris.wq.my-queue",
        streamKey: "iris:my-queue",
        callback: jest.fn(),
        abortController: ac,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc } as any,
      };

      const { queue, state } = createQueue();
      await queue.consume("my-queue", async () => {});

      await queue.unconsume("my-queue");

      expect(ac.signal.aborted).toBe(true);
      // Called twice: main loop + broadcast loop (both share the mock)
      expect(dc).toHaveBeenCalledTimes(2);
    });

    it("should be a no-op for unknown queue", async () => {
      const { queue } = createQueue();
      await expect(queue.unconsume("unknown")).resolves.toBeUndefined();
    });
  });

  describe("unconsumeAll", () => {
    it("should abort all owned consumer loops", async () => {
      const ac1 = new AbortController();
      const dc1 = jest.fn().mockResolvedValue(undefined);
      const ac2 = new AbortController();
      const dc2 = jest.fn().mockResolvedValue(undefined);

      const { queue, state } = createQueue();

      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-a",
        groupName: "iris.wq.q1",
        streamKey: "iris:q1",
        callback: jest.fn(),
        abortController: ac1,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc1 } as any,
      };
      await queue.consume("q1", async () => {});

      mockCreateConsumerLoopResult = {
        consumerTag: "ctag-b",
        groupName: "iris.wq.q2",
        streamKey: "iris:q2",
        callback: jest.fn(),
        abortController: ac2,
        loopPromise: Promise.resolve(),
        connection: { disconnect: dc2 } as any,
      };
      await queue.consume("q2", async () => {});

      await queue.unconsumeAll();

      expect(ac1.signal.aborted).toBe(true);
      expect(ac2.signal.aborted).toBe(true);
    });
  });
});
