import type { RedisClient, RedisStreamEntry } from "../types/redis-types.js";
import {
  createConsumerLoop,
  type CreateConsumerLoopOptions,
} from "./create-consumer-loop.js";
import { describe, expect, it, vi, type Mock } from "vitest";

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

// Simulate XREADGROUP BLOCK — must return a delayed promise so the consumer
// loop yields to the event loop instead of spinning in a tight microtask loop.
const blockingNull = () => new Promise((r) => setTimeout(() => r(null), 50));

// A fully-populated duplicated (consumer) connection. The loop runs entirely on
// the connection returned by `duplicate()`, so every method the loop uses —
// XPENDING (reclaim), XRANGE (inspect config), XCLAIM (reclaim), XREADGROUP
// (new), XACK — must live here. Sensible defaults: no pending, no new messages.
const createDuplicated = (overrides: Partial<RedisClient> = {}) => ({
  xreadgroup: vi.fn().mockImplementation(blockingNull),
  xpending: vi.fn().mockResolvedValue([]),
  xrange: vi.fn().mockResolvedValue([]),
  xclaim: vi.fn().mockResolvedValue([]),
  xack: vi.fn().mockResolvedValue(1),
  disconnect: vi.fn().mockResolvedValue(undefined),
  on: vi.fn(),
  ...overrides,
});

const createMockConnection = (
  duplicated: Record<string, unknown> = createDuplicated(),
): RedisClient => {
  const mock: RedisClient = {
    xadd: vi.fn().mockResolvedValue("1-0"),
    xreadgroup: vi.fn().mockImplementation(blockingNull),
    xack: vi.fn().mockResolvedValue(1),
    xpending: vi.fn().mockResolvedValue([]),
    xclaim: vi.fn().mockResolvedValue([]),
    xrange: vi.fn().mockResolvedValue([]),
    xgroup: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    ping: vi.fn().mockResolvedValue("PONG"),
    duplicate: vi.fn(),
    disconnect: vi.fn().mockResolvedValue(undefined),
    quit: vi.fn().mockResolvedValue("OK"),
    on: vi.fn(),
  };
  (mock.duplicate as Mock).mockReturnValue(duplicated);
  return mock;
};

const baseOptions = (
  connection: RedisClient,
  logger: ReturnType<typeof createMockLogger>,
  onEntry: CreateConsumerLoopOptions["onEntry"],
): CreateConsumerLoopOptions => ({
  publishConnection: connection,
  streamKey: "iris:test-topic",
  groupName: "iris.wq.test",
  consumerName: "iris:host:1234:abc",
  blockMs: 100,
  count: 10,
  onEntry,
  logger: logger as any,
});

// A well-formed flat-hash stream entry with a constant 1000ms retry backoff.
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

const settle = (ms = 200) => new Promise((resolve) => setTimeout(resolve, ms));

describe("createConsumerLoop", () => {
  describe("consumer group creation", () => {
    it("should create consumer group via XGROUP CREATE", async () => {
      const connection = createMockConnection();
      const logger = createMockLogger();
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

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
      const connection = createMockConnection();
      (connection.xgroup as Mock).mockRejectedValue(
        new Error("BUSYGROUP Consumer Group already exists"),
      );
      const logger = createMockLogger();
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      expect(logger.debug).toHaveBeenCalledWith(
        "Consumer group already exists",
        expect.any(Object),
      );

      loop.abortController.abort();
      await loop.loopPromise;
    });

    it("should rethrow non-BUSYGROUP errors", async () => {
      const connection = createMockConnection();
      (connection.xgroup as Mock).mockRejectedValue(new Error("Connection refused"));
      const logger = createMockLogger();
      const onEntry = vi.fn();

      await expect(
        createConsumerLoop(baseOptions(connection, logger, onEntry)),
      ).rejects.toThrow("Connection refused");
    });
  });

  describe("loop structure", () => {
    it("should return a RedisConsumerLoop with all required fields", async () => {
      const connection = createMockConnection();
      const logger = createMockLogger();
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

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
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      expect(connection.duplicate).toHaveBeenCalledTimes(1);

      loop.abortController.abort();
      await loop.loopPromise;
    });
  });

  describe("new-message (XREADGROUP >) processing", () => {
    it("delivers new entries with attempt 0 and XACKs on success", async () => {
      const fields = createStreamEntryFields();
      let reads = 0;

      const duplicated = createDuplicated({
        xreadgroup: vi.fn().mockImplementation(() => {
          reads++;
          if (reads === 1) {
            return Promise.resolve([["iris:test-topic", [["1-0", fields]]]]);
          }
          return blockingNull();
        }),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const seen: Array<RedisStreamEntry> = [];
      const onEntry = vi.fn().mockImplementation(async (entry: RedisStreamEntry) => {
        seen.push(entry);
        return "ack" as const;
      });

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(onEntry).toHaveBeenCalledTimes(1);
      expect(seen[0].attempt).toBe(0);
      expect(duplicated.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "1-0",
      );
    });

    it("calls onEntry for each entry and XACKs each", async () => {
      const fields = createStreamEntryFields();
      let reads = 0;

      const duplicated = createDuplicated({
        xreadgroup: vi.fn().mockImplementation(() => {
          reads++;
          if (reads === 1) {
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
          return blockingNull();
        }),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn().mockResolvedValue("ack");

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(onEntry).toHaveBeenCalledTimes(2);
      expect(duplicated.xack).toHaveBeenCalledTimes(2);
    });

    it("does NOT XACK when the handler returns 'retain' (PEL-retain retry)", async () => {
      const fields = createStreamEntryFields();
      let reads = 0;

      const duplicated = createDuplicated({
        xreadgroup: vi.fn().mockImplementation(() => {
          reads++;
          if (reads === 1) {
            return Promise.resolve([["iris:test-topic", [["1-0", fields]]]]);
          }
          return blockingNull();
        }),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn().mockResolvedValue("retain");

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(onEntry).toHaveBeenCalledTimes(1);
      // Retained: the entry stays in the PEL for the reclaim to redeliver.
      expect(duplicated.xack).not.toHaveBeenCalled();
    });

    it("logs and ACKs (drops) when onEntry throws (poison entry)", async () => {
      const fields = createStreamEntryFields();
      let reads = 0;

      const duplicated = createDuplicated({
        xreadgroup: vi.fn().mockImplementation(() => {
          reads++;
          if (reads === 1) {
            return Promise.resolve([["iris:test-topic", [["1-0", fields]]]]);
          }
          return blockingNull();
        }),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn().mockRejectedValue(new Error("handler failed"));

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(logger.error).toHaveBeenCalledWith(
        "Malformed or unprocessable stream entry — message data lost (ACKed to prevent redelivery)",
        expect.objectContaining({ entryId: "1-0" }),
      );
      expect(duplicated.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "1-0",
      );
    });
  });

  describe("reclaim (XPENDING + XCLAIM) of retained/orphaned pending entries", () => {
    it("reclaims a due pending entry and redelivers it with the native delivery-count attempt", async () => {
      const fields = createStreamEntryFields(); // constant 1000ms backoff
      let pends = 0;

      const duplicated = createDuplicated({
        // First pass: one entry, delivered once (deliveries=1), idle 2000ms >
        // required 1000ms -> due. Subsequent passes: empty (it was acked).
        xpending: vi.fn().mockImplementation(() => {
          pends++;
          if (pends === 1) {
            return Promise.resolve([["1-0", "iris:host:1234:abc:con", 2000, 1]]);
          }
          return Promise.resolve([]);
        }),
        xrange: vi.fn().mockResolvedValue([["1-0", fields]]),
        xclaim: vi.fn().mockResolvedValue([["1-0", fields]]),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const seen: Array<RedisStreamEntry> = [];
      const onEntry = vi.fn().mockImplementation(async (entry: RedisStreamEntry) => {
        seen.push(entry);
        return "ack" as const;
      });

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      // Claimed to THIS loop's consumer, with min-idle-time = the computed
      // backoff (1000ms), so the redelivery is targeted to this group only.
      expect(duplicated.xclaim).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        `iris:host:1234:abc:${loop.consumerTag}`,
        1000,
        "1-0",
      );
      expect(onEntry).toHaveBeenCalledTimes(1);
      // delivery count 1 -> attempt 1 (delivery N -> attempt N-1).
      expect(seen[0].attempt).toBe(1);
      expect(duplicated.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "1-0",
      );
    });

    it("does NOT reclaim an entry still inside its backoff window", async () => {
      const fields = createStreamEntryFields(); // constant 1000ms backoff

      const duplicated = createDuplicated({
        // idle 100ms < required 1000ms -> not yet due.
        xpending: vi.fn().mockResolvedValue([["1-0", "iris:host:1234:abc:con", 100, 1]]),
        xrange: vi.fn().mockResolvedValue([["1-0", fields]]),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn().mockResolvedValue("ack");

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(duplicated.xclaim).not.toHaveBeenCalled();
      expect(onEntry).not.toHaveBeenCalled();
    });

    it("ACKs a pending entry that was trimmed out of the stream (dangling PEL ref)", async () => {
      let pends = 0;

      const duplicated = createDuplicated({
        xpending: vi.fn().mockImplementation(() => {
          pends++;
          if (pends === 1) {
            return Promise.resolve([["9-0", "iris:host:1234:abc:con", 5000, 2]]);
          }
          return Promise.resolve([]);
        }),
        // XRANGE returns empty — the entry was trimmed by MAXLEN.
        xrange: vi.fn().mockResolvedValue([]),
      });

      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      await settle();

      loop.abortController.abort();
      await loop.loopPromise;

      expect(duplicated.xclaim).not.toHaveBeenCalled();
      expect(onEntry).not.toHaveBeenCalled();
      expect(duplicated.xack).toHaveBeenCalledWith(
        "iris:test-topic",
        "iris.wq.test",
        "9-0",
      );
    });
  });

  describe("abort", () => {
    it("should stop and disconnect when aborted", async () => {
      const duplicated = createDuplicated();
      const connection = createMockConnection(duplicated);
      const logger = createMockLogger();
      const onEntry = vi.fn();

      const loop = await createConsumerLoop(baseOptions(connection, logger, onEntry));

      loop.abortController.abort();
      await loop.loopPromise;

      expect(duplicated.disconnect).toHaveBeenCalledTimes(1);
    });
  });
});
