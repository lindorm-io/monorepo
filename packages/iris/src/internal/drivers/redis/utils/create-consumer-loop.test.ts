import type { RedisClient } from "../types/redis-types";
import {
  createConsumerLoop,
  type CreateConsumerLoopOptions,
} from "./create-consumer-loop";

const createMockLogger = () => ({
  child: jest.fn().mockReturnThis(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  silly: jest.fn(),
  verbose: jest.fn(),
});

// Simulate XREADGROUP BLOCK — must return a delayed promise so the consumer
// loop yields to the event loop instead of spinning in a tight microtask loop.
const blockingNull = () => new Promise((r) => setTimeout(() => r(null), 50));

const createMockConnection = (overrides?: Partial<RedisClient>): RedisClient => {
  const mock: RedisClient = {
    xadd: jest.fn().mockResolvedValue("1-0"),
    xreadgroup: jest.fn().mockImplementation(blockingNull),
    xack: jest.fn().mockResolvedValue(1),
    xgroup: jest.fn().mockResolvedValue("OK"),
    del: jest.fn().mockResolvedValue(1),
    ping: jest.fn().mockResolvedValue("PONG"),
    duplicate: jest.fn(),
    disconnect: jest.fn().mockResolvedValue(undefined),
    quit: jest.fn().mockResolvedValue("OK"),
    on: jest.fn(),
    ...overrides,
  };
  (mock.duplicate as jest.Mock).mockReturnValue({
    ...mock,
    duplicate: jest.fn(),
    ping: jest.fn().mockResolvedValue("PONG"),
    xreadgroup: overrides?.xreadgroup ?? jest.fn().mockImplementation(blockingNull),
    xack: overrides?.xack ?? jest.fn().mockResolvedValue(1),
    disconnect: jest.fn().mockResolvedValue(undefined),
    on: jest.fn(),
  });
  return mock;
};

const createStreamEntryFields = (): Array<string> => [
  "payload",
  Buffer.from('{"data":"test"}').toString("base64"),
  "headers",
  JSON.stringify({}),
  "topic",
  "test-topic",
  "attempt",
  "0",
  "maxRetries",
  "3",
  "retryStrategy",
  "constant",
  "retryDelay",
  "1000",
  "retryDelayMax",
  "30000",
  "retryMultiplier",
  "2",
  "retryJitter",
  "false",
  "priority",
  "0",
  "timestamp",
  "1700000000000",
  "expiry",
  "",
  "broadcast",
  "false",
  "replyTo",
  "",
  "correlationId",
  "",
];

describe("createConsumerLoop", () => {
  describe("consumer group creation", () => {
    it("should create consumer group via XGROUP CREATE", async () => {
      const connection = createMockConnection();
      const logger = createMockLogger();
      const onEntry = jest.fn();

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 2000,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      expect(connection.xgroup).toHaveBeenCalledWith(
        "CREATE",
        "iris:test-topic",
        "iris.wq.test",
        "$",
        "MKSTREAM",
      );

      loop.abortController.abort();
      await loop.loopPromise;
    });

    it("should handle BUSYGROUP error gracefully", async () => {
      const connection = createMockConnection({
        xgroup: jest
          .fn()
          .mockRejectedValue(new Error("BUSYGROUP Consumer Group already exists")),
      });
      const logger = createMockLogger();
      const onEntry = jest.fn();

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 2000,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      expect(logger.debug).toHaveBeenCalledWith(
        "Consumer group already exists",
        expect.any(Object),
      );

      loop.abortController.abort();
      await loop.loopPromise;
    });

    it("should rethrow non-BUSYGROUP errors", async () => {
      const connection = createMockConnection({
        xgroup: jest.fn().mockRejectedValue(new Error("Connection refused")),
      });
      const logger = createMockLogger();
      const onEntry = jest.fn();

      await expect(
        createConsumerLoop({
          publishConnection: connection,
          streamKey: "iris:test-topic",
          groupName: "iris.wq.test",
          consumerName: "iris:host:1234:abc",
          blockMs: 2000,
          count: 10,
          onEntry,
          logger: logger as any,
        }),
      ).rejects.toThrow("Connection refused");
    });
  });

  describe("loop structure", () => {
    it("should return a RedisConsumerLoop with all required fields", async () => {
      const connection = createMockConnection();
      const logger = createMockLogger();
      const onEntry = jest.fn();

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 2000,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      expect(loop.consumerTag).toBeDefined();
      expect(loop.groupName).toBe("iris.wq.test");
      expect(loop.streamKey).toBe("iris:test-topic");
      expect(loop.callback).toBe(onEntry);
      expect(loop.abortController).toBeInstanceOf(AbortController);
      expect(loop.loopPromise).toBeInstanceOf(Promise);
      expect(loop.ready).toBeInstanceOf(Promise);
      expect(loop.connection).toBeDefined();

      loop.abortController.abort();
      await loop.loopPromise;
    });

    it("should duplicate the connection for the consumer", async () => {
      const connection = createMockConnection();
      const logger = createMockLogger();
      const onEntry = jest.fn();

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 2000,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      expect(connection.duplicate).toHaveBeenCalledTimes(1);

      loop.abortController.abort();
      await loop.loopPromise;
    });
  });

  describe("message processing", () => {
    it("should process pending messages first then switch to new", async () => {
      let callCount = 0;
      const fields = createStreamEntryFields();

      const duplicatedConnection = {
        xreadgroup: jest.fn().mockImplementation((...args: Array<any>) => {
          callCount++;
          const readId = args[args.length - 1];

          if (callCount === 1 && readId === "0") {
            return Promise.resolve([["iris:test-topic", [["1-0", fields]]]]);
          }
          if (callCount === 2 && readId === "0") {
            return Promise.resolve([["iris:test-topic", []]]);
          }
          // After switching to ">", abort
          return new Promise((resolve) => {
            setTimeout(() => resolve(null), 50);
          });
        }),
        xack: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      const connection = createMockConnection();
      (connection.duplicate as jest.Mock).mockReturnValue(duplicatedConnection);

      const logger = createMockLogger();
      const onEntry = jest.fn().mockResolvedValue(undefined);

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 100,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      // Wait for the loop to process pending then hit ">"
      await new Promise((resolve) => setTimeout(resolve, 200));

      loop.abortController.abort();
      await loop.loopPromise;

      expect(onEntry).toHaveBeenCalledTimes(1);
      expect(duplicatedConnection.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "1-0",
      );
    });

    it("should call onEntry for each entry and XACK after", async () => {
      const fields = createStreamEntryFields();
      let callCount = 0;

      const duplicatedConnection = {
        xreadgroup: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([
              [
                "iris:test-topic",
                [
                  ["1-0", fields],
                  ["2-0", fields],
                ],
              ],
            ]);
          }
          return new Promise((resolve) => setTimeout(() => resolve(null), 50));
        }),
        xack: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      const connection = createMockConnection();
      (connection.duplicate as jest.Mock).mockReturnValue(duplicatedConnection);

      const logger = createMockLogger();
      const onEntry = jest.fn().mockResolvedValue(undefined);

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 100,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      loop.abortController.abort();
      await loop.loopPromise;

      expect(onEntry).toHaveBeenCalledTimes(2);
      expect(duplicatedConnection.xack).toHaveBeenCalledTimes(2);
    });

    it("should log and continue when onEntry throws", async () => {
      const fields = createStreamEntryFields();
      let callCount = 0;

      const duplicatedConnection = {
        xreadgroup: jest.fn().mockImplementation(() => {
          callCount++;
          if (callCount === 1) {
            return Promise.resolve([["iris:test-topic", [["1-0", fields]]]]);
          }
          return new Promise((resolve) => setTimeout(() => resolve(null), 50));
        }),
        xack: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      const connection = createMockConnection();
      (connection.duplicate as jest.Mock).mockReturnValue(duplicatedConnection);

      const logger = createMockLogger();
      const onEntry = jest.fn().mockRejectedValue(new Error("handler failed"));

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 100,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      await new Promise((resolve) => setTimeout(resolve, 200));

      loop.abortController.abort();
      await loop.loopPromise;

      expect(logger.error).toHaveBeenCalledWith(
        "Malformed or unprocessable stream entry — message data lost (ACKed to prevent redelivery)",
        expect.objectContaining({ entryId: "1-0" }),
      );
      // XACK should still be called after error
      expect(duplicatedConnection.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "1-0",
      );
    });
  });

  describe("abort", () => {
    it("should stop and disconnect when aborted", async () => {
      const duplicatedConnection = {
        xreadgroup: jest
          .fn()
          .mockImplementation(
            () => new Promise((resolve) => setTimeout(() => resolve(null), 50)),
          ),
        xack: jest.fn().mockResolvedValue(1),
        disconnect: jest.fn().mockResolvedValue(undefined),
        on: jest.fn(),
      };

      const connection = createMockConnection();
      (connection.duplicate as jest.Mock).mockReturnValue(duplicatedConnection);

      const logger = createMockLogger();
      const onEntry = jest.fn();

      const loop = await createConsumerLoop({
        publishConnection: connection,
        streamKey: "iris:test-topic",
        groupName: "iris.wq.test",
        consumerName: "iris:host:1234:abc",
        blockMs: 100,
        count: 10,
        onEntry,
        logger: logger as any,
      });

      loop.abortController.abort();
      await loop.loopPromise;

      expect(duplicatedConnection.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
