import Redis from "ioredis";
import { randomUUID } from "crypto";
import type { IrisEnvelope } from "../types/iris-envelope";
import type { DeadLetterEntry } from "../../types/dead-letter";
import { RedisDeadLetterStore } from "./RedisDeadLetterStore";

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  topic: "test-topic",
  payload: Buffer.from("integration-test-payload"),
  headers: { "x-test": "true" },
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
  id: randomUUID(),
  envelope: createEnvelope(),
  topic: "test-topic",
  error: "Test error",
  errorStack: "Error: Test error\n    at test.ts:1",
  attempt: 3,
  timestamp: Date.now(),
  ...overrides,
});

describe("RedisDeadLetterStore (integration)", () => {
  let client: Redis;
  let store: RedisDeadLetterStore;
  let keyPrefix: string;

  beforeEach(() => {
    keyPrefix = `test:dlq:${randomUUID()}`;
    client = new Redis("redis://localhost:6379", { maxRetriesPerRequest: 3 });
    store = new RedisDeadLetterStore(client, { keyPrefix });
  });

  afterEach(async () => {
    await client.del(keyPrefix);
    await client.del(`${keyPrefix}:data`);
    await client.quit();
  });

  describe("add + list roundtrip", () => {
    it("should add and list entries", async () => {
      const entry = createEntry();
      await store.add(entry);

      const listed = await store.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe(entry.id);
      expect(listed[0].topic).toBe(entry.topic);
      expect(listed[0].error).toBe(entry.error);
    });
  });

  describe("list with topic filtering", () => {
    it("should filter entries by topic", async () => {
      await store.add(createEntry({ id: "a", topic: "topic-a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", topic: "topic-b", timestamp: 2000 }));
      await store.add(createEntry({ id: "c", topic: "topic-a", timestamp: 3000 }));

      const filtered = await store.list({ topic: "topic-a" });
      expect(filtered).toHaveLength(2);
      expect(filtered.every((e) => e.topic === "topic-a")).toBe(true);
    });

    it("should return empty array when no entries match topic", async () => {
      await store.add(createEntry({ id: "a", topic: "topic-a", timestamp: 1000 }));

      const filtered = await store.list({ topic: "nonexistent" });
      expect(filtered).toHaveLength(0);
    });
  });

  describe("list with pagination", () => {
    it("should paginate with limit and offset", async () => {
      await store.add(createEntry({ id: "a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", timestamp: 2000 }));
      await store.add(createEntry({ id: "c", timestamp: 3000 }));
      await store.add(createEntry({ id: "d", timestamp: 4000 }));

      // Newest first: d, c, b, a
      const page1 = await store.list({ limit: 2, offset: 0 });
      expect(page1).toHaveLength(2);
      expect(page1[0].id).toBe("d");
      expect(page1[1].id).toBe("c");

      const page2 = await store.list({ limit: 2, offset: 2 });
      expect(page2).toHaveLength(2);
      expect(page2[0].id).toBe("b");
      expect(page2[1].id).toBe("a");
    });
  });

  describe("get", () => {
    it("should get entry by id", async () => {
      const entry = createEntry();
      await store.add(entry);

      const found = await store.get(entry.id);
      expect(found).not.toBeNull();
      expect(found!.id).toBe(entry.id);
      expect(found!.error).toBe(entry.error);
    });

    it("should return null for unknown id", async () => {
      const found = await store.get("nonexistent");
      expect(found).toBeNull();
    });
  });

  describe("remove", () => {
    it("should remove entry by id", async () => {
      const entry = createEntry();
      await store.add(entry);

      const removed = await store.remove(entry.id);
      expect(removed).toBe(true);

      const found = await store.get(entry.id);
      expect(found).toBeNull();
    });

    it("should return false for unknown id", async () => {
      const removed = await store.remove("nonexistent");
      expect(removed).toBe(false);
    });
  });

  describe("purge", () => {
    it("should purge all entries", async () => {
      await store.add(createEntry({ id: "a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", timestamp: 2000 }));

      const count = await store.purge();
      expect(count).toBe(2);

      const listed = await store.list();
      expect(listed).toHaveLength(0);
    });

    it("should purge by topic", async () => {
      await store.add(createEntry({ id: "a", topic: "topic-a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", topic: "topic-b", timestamp: 2000 }));
      await store.add(createEntry({ id: "c", topic: "topic-a", timestamp: 3000 }));

      const count = await store.purge({ topic: "topic-a" });
      expect(count).toBe(2);

      const listed = await store.list();
      expect(listed).toHaveLength(1);
      expect(listed[0].id).toBe("b");
    });

    it("should return 0 when purging empty store", async () => {
      const count = await store.purge();
      expect(count).toBe(0);
    });
  });

  describe("count", () => {
    it("should return total count", async () => {
      await store.add(createEntry({ id: "a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", timestamp: 2000 }));

      expect(await store.count()).toBe(2);
    });

    it("should return count filtered by topic", async () => {
      await store.add(createEntry({ id: "a", topic: "topic-a", timestamp: 1000 }));
      await store.add(createEntry({ id: "b", topic: "topic-b", timestamp: 2000 }));
      await store.add(createEntry({ id: "c", topic: "topic-a", timestamp: 3000 }));

      expect(await store.count({ topic: "topic-a" })).toBe(2);
      expect(await store.count({ topic: "topic-b" })).toBe(1);
      expect(await store.count({ topic: "nonexistent" })).toBe(0);
    });

    it("should return 0 when empty", async () => {
      expect(await store.count()).toBe(0);
    });
  });

  describe("Buffer payload roundtrip", () => {
    it("should preserve Buffer payload through serialize/deserialize", async () => {
      const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f]);
      const entry = createEntry({
        envelope: createEnvelope({ payload: binary }),
      });

      await store.add(entry);
      const found = await store.get(entry.id);

      expect(found).not.toBeNull();
      expect(Buffer.isBuffer(found!.envelope.payload)).toBe(true);
      expect(found!.envelope.payload).toEqual(binary);
    });
  });
});
