import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { DeadLetterEntry } from "../../types/dead-letter.js";
import { RedisDeadLetterStore } from "./RedisDeadLetterStore.js";
import { describe, expect, it, vi } from "vitest";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  topic: "test-topic",
  payload: Buffer.from("test"),
  headers: {},
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 0,
  maxRetries: 3,
  retryStrategy: "constant",
  retryDelay: 1000,
  retryDelayMax: 30000,
  retryMultiplier: 2,
  retryJitter: false,
  replyTo: null,
  correlationId: null,
  identifierValue: null,
  ...overrides,
});

const createEntry = (overrides: Partial<DeadLetterEntry> = {}): DeadLetterEntry => ({
  id: "entry-1",
  envelope: createEnvelope(),
  topic: "test-topic",
  timestamp: 1000,
  error: "max retries exceeded",
  errorStack: null,
  attempt: 3,
  ...overrides,
});

const createMockPipeline = (execResult: Array<[Error | null, unknown]> | null = null) => {
  const pipeline = {
    zadd: vi.fn().mockReturnThis(),
    hset: vi.fn().mockReturnThis(),
    zrem: vi.fn().mockReturnThis(),
    hdel: vi.fn().mockReturnThis(),
    del: vi.fn().mockReturnThis(),
    exec: vi.fn().mockResolvedValue(
      execResult ?? [
        [null, 1],
        [null, 1],
      ],
    ),
  };
  return pipeline;
};

const createMockClient = (pipeline = createMockPipeline()) => ({
  pipeline: vi.fn().mockReturnValue(pipeline),
  zrevrange: vi.fn().mockResolvedValue([]),
  zrange: vi.fn().mockResolvedValue([]),
  zcard: vi.fn().mockResolvedValue(0),
  hmget: vi.fn().mockResolvedValue([]),
  hget: vi.fn().mockResolvedValue(null),
  quit: vi.fn().mockResolvedValue("OK"),
});

describe("RedisDeadLetterStore", () => {
  describe("add", () => {
    it("should throw when pipeline returns an error tuple", async () => {
      const error = new Error("WRONGTYPE Operation against a key");
      const pipeline = createMockPipeline([
        [null, 1],
        [error, null],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.add(createEntry())).rejects.toThrow(error);
    });

    it("should throw when pipeline returns null results", async () => {
      const pipeline = createMockPipeline();
      pipeline.exec.mockResolvedValue(null);
      const client = createMockClient(pipeline);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.add(createEntry())).rejects.toThrow(
        "Redis pipeline returned null results",
      );
    });

    it("should not throw when pipeline succeeds", async () => {
      const client = createMockClient();
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.add(createEntry())).resolves.toBeUndefined();
    });
  });

  describe("remove", () => {
    it("should throw when pipeline returns an error tuple", async () => {
      const error = new Error("READONLY You can't write against a read only replica");
      const pipeline = createMockPipeline([
        [error, null],
        [null, 0],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.remove("some-id")).rejects.toThrow(error);
    });

    it("should return true when zrem removed the member", async () => {
      const pipeline = createMockPipeline([
        [null, 1],
        [null, 1],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.remove("some-id")).resolves.toBe(true);
    });

    it("should return false when zrem did not remove the member", async () => {
      const pipeline = createMockPipeline([
        [null, 0],
        [null, 0],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.remove("some-id")).resolves.toBe(false);
    });
  });

  describe("purge", () => {
    it("should throw when pipeline returns an error tuple during full purge", async () => {
      const error = new Error("MISCONF Redis is configured to save RDB snapshots");
      const pipeline = createMockPipeline([
        [error, null],
        [null, 1],
      ]);
      const client = createMockClient(pipeline);
      client.zcard.mockResolvedValue(5);
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.purge()).rejects.toThrow(error);
    });

    it("should throw when pipeline returns an error during topic-filtered purge", async () => {
      const error = new Error("ERR some error");
      const pipeline = createMockPipeline([
        [error, null],
        [null, 1],
      ]);
      const client = createMockClient(pipeline);
      client.zrange.mockResolvedValue(["id-1"]);

      const entry = createEntry({ id: "id-1", topic: "target-topic" });
      const serialized = JSON.stringify({
        ...entry,
        envelope: {
          ...entry.envelope,
          payload: entry.envelope.payload.toString("base64"),
        },
      });
      client.hmget.mockResolvedValue([serialized]);

      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await expect(store.purge({ topic: "target-topic" })).rejects.toThrow(error);
    });
  });

  describe("close", () => {
    it("should quit the client when ownedClient is true", async () => {
      const client = createMockClient();
      const store = new RedisDeadLetterStore(client, { ownedClient: true });

      await store.close();

      expect(client.quit).toHaveBeenCalled();
    });

    it("should not quit the client when ownedClient is false", async () => {
      const client = createMockClient();
      const store = new RedisDeadLetterStore(client, { ownedClient: false });

      await store.close();

      expect(client.quit).not.toHaveBeenCalled();
    });
  });
});
