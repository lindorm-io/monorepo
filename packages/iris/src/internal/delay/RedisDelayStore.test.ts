import type { IrisEnvelope } from "../types/iris-envelope";
import type { DelayedEntry } from "../../types/delay";
import { RedisDelayStore } from "./RedisDelayStore";
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

const createEntry = (overrides: Partial<DelayedEntry> = {}): DelayedEntry => ({
  id: "entry-1",
  envelope: createEnvelope(),
  topic: "test-topic",
  deliverAt: 1000,
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
  defineCommand: vi.fn(),
  irisDelayPoll: vi.fn().mockResolvedValue([]),
  zcard: vi.fn().mockResolvedValue(0),
  quit: vi.fn().mockResolvedValue("OK"),
});

describe("RedisDelayStore", () => {
  describe("schedule", () => {
    it("should throw when pipeline returns an error tuple", async () => {
      const error = new Error("WRONGTYPE Operation against a key");
      const pipeline = createMockPipeline([
        [null, 1],
        [error, null],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.schedule(createEntry())).rejects.toThrow(error);
    });

    it("should throw when pipeline returns null results", async () => {
      const pipeline = createMockPipeline();
      pipeline.exec.mockResolvedValue(null);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.schedule(createEntry())).rejects.toThrow(
        "Redis pipeline returned null results",
      );
    });

    it("should not throw when pipeline succeeds", async () => {
      const client = createMockClient();
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.schedule(createEntry())).resolves.toBeUndefined();
    });
  });

  describe("cancel", () => {
    it("should throw when pipeline returns an error tuple", async () => {
      const error = new Error("READONLY You can't write against a read only replica");
      const pipeline = createMockPipeline([
        [error, null],
        [null, 0],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.cancel("some-id")).rejects.toThrow(error);
    });

    it("should return true when zrem removed the member", async () => {
      const pipeline = createMockPipeline([
        [null, 1],
        [null, 1],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.cancel("some-id")).resolves.toBe(true);
    });

    it("should return false when zrem did not remove the member", async () => {
      const pipeline = createMockPipeline([
        [null, 0],
        [null, 0],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.cancel("some-id")).resolves.toBe(false);
    });
  });

  describe("clear", () => {
    it("should throw when pipeline returns an error tuple", async () => {
      const error = new Error("MISCONF Redis is configured to save RDB snapshots");
      const pipeline = createMockPipeline([
        [error, null],
        [null, 1],
      ]);
      const client = createMockClient(pipeline);
      const store = new RedisDelayStore(client, { ownedClient: true });

      await expect(store.clear()).rejects.toThrow(error);
    });
  });

  describe("close", () => {
    it("should quit the client when ownedClient is true", async () => {
      const client = createMockClient();
      const store = new RedisDelayStore(client, { ownedClient: true });

      await store.close();

      expect(client.quit).toHaveBeenCalled();
    });

    it("should not quit the client when ownedClient is false", async () => {
      const client = createMockClient();
      const store = new RedisDelayStore(client, { ownedClient: false });

      await store.close();

      expect(client.quit).not.toHaveBeenCalled();
    });
  });
});
