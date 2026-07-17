import { Redis } from "ioredis";
import { randomUUID } from "crypto";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { DelayedEntry } from "../../types/delay.js";
import { RedisDelayStore } from "./RedisDelayStore.js";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

const createEntry = (overrides: Partial<DelayedEntry> = {}): DelayedEntry => ({
  id: randomUUID(),
  envelope: createEnvelope(),
  topic: "test-topic",
  deliverAt: 1000,
  ...overrides,
});

describe("RedisDelayStore (integration)", () => {
  let client: Redis;
  let store: RedisDelayStore;
  let keyPrefix: string;

  beforeEach(() => {
    keyPrefix = `test:delay:${randomUUID()}`;
    client = new Redis("redis://localhost:6379", { maxRetriesPerRequest: 3 });
    store = new RedisDelayStore(client, { keyPrefix });
  });

  afterEach(async () => {
    await store.clear();
    await client.quit();
  });

  describe("schedule + peek roundtrip", () => {
    it("should schedule and peek entries", async () => {
      const entry = createEntry({ deliverAt: 100 });
      await store.schedule(entry);

      const peeked = await store.peek(200);
      expect(peeked).toHaveLength(1);
      expect(peeked[0].id).toBe(entry.id);
      expect(peeked[0].topic).toBe(entry.topic);
      expect(peeked[0].deliverAt).toBe(entry.deliverAt);
    });

    it("should not peek entries scheduled in the future", async () => {
      await store.schedule(createEntry({ deliverAt: 9999999999 }));

      const peeked = await store.peek(1000);
      expect(peeked).toHaveLength(0);
    });
  });

  describe("peek is non-destructive (delivery-failure recovery)", () => {
    it("should keep entries after peek so a failed delivery is not lost", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      // Peeking does NOT remove — this is what lets the DelayManager retry an
      // entry whose delivery failed (e.g. the connection dropped at fire time).
      const first = await store.peek(300);
      expect(first).toHaveLength(2);

      const second = await store.peek(300);
      expect(second).toHaveLength(2);
      expect(await store.size()).toBe(2);
    });

    it("should stop returning an entry only once it is removed via cancel", async () => {
      const entry = createEntry({ id: "delivered", deliverAt: 100 });
      await store.schedule(entry);

      // Simulate a successful delivery: peek, then remove.
      expect(await store.peek(200)).toHaveLength(1);
      await store.cancel(entry.id);

      expect(await store.peek(200)).toHaveLength(0);
      expect(await store.size()).toBe(0);
    });
  });

  describe("cancel", () => {
    it("should cancel a scheduled entry", async () => {
      const entry = createEntry({ deliverAt: 100 });
      await store.schedule(entry);

      const cancelled = await store.cancel(entry.id);
      expect(cancelled).toBe(true);

      const peeked = await store.peek(200);
      expect(peeked).toHaveLength(0);
    });

    it("should return false for unknown id", async () => {
      const cancelled = await store.cancel("nonexistent");
      expect(cancelled).toBe(false);
    });
  });

  describe("size", () => {
    it("should reflect pending count", async () => {
      expect(await store.size()).toBe(0);

      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));
      expect(await store.size()).toBe(2);

      // Peek is non-destructive, so size is unchanged until an entry is removed.
      await store.peek(150);
      expect(await store.size()).toBe(2);

      await store.cancel("a");
      expect(await store.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      await store.clear();
      expect(await store.size()).toBe(0);

      const peeked = await store.peek(999999);
      expect(peeked).toHaveLength(0);
    });
  });

  describe("Buffer payload roundtrip", () => {
    it("should preserve Buffer payload through serialize/deserialize", async () => {
      const binary = Buffer.from([0x00, 0x01, 0xff, 0xfe, 0x80, 0x7f]);
      const entry = createEntry({
        deliverAt: 100,
        envelope: createEnvelope({ payload: binary }),
      });

      await store.schedule(entry);
      const polled = await store.peek(200);

      expect(polled).toHaveLength(1);
      expect(Buffer.isBuffer(polled[0].envelope.payload)).toBe(true);
      expect(polled[0].envelope.payload).toEqual(binary);
    });

    it("should preserve all envelope fields", async () => {
      const envelope = createEnvelope({
        topic: "my-topic",
        headers: { "x-custom": "value" },
        priority: 5,
        replyTo: "reply-queue",
        correlationId: "corr-123",
      });
      const entry = createEntry({ deliverAt: 100, envelope });

      await store.schedule(entry);
      const polled = await store.peek(200);

      expect(polled[0].envelope.topic).toBe("my-topic");
      expect(polled[0].envelope.headers).toEqual({ "x-custom": "value" });
      expect(polled[0].envelope.priority).toBe(5);
      expect(polled[0].envelope.replyTo).toBe("reply-queue");
      expect(polled[0].envelope.correlationId).toBe("corr-123");
    });
  });
});
