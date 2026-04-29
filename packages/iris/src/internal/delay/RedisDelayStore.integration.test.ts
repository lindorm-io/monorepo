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

  describe("schedule + poll roundtrip", () => {
    it("should schedule and poll entries", async () => {
      const entry = createEntry({ deliverAt: 100 });
      await store.schedule(entry);

      const polled = await store.poll(200);
      expect(polled).toHaveLength(1);
      expect(polled[0].id).toBe(entry.id);
      expect(polled[0].topic).toBe(entry.topic);
      expect(polled[0].deliverAt).toBe(entry.deliverAt);
    });

    it("should not poll entries scheduled in the future", async () => {
      await store.schedule(createEntry({ deliverAt: 9999999999 }));

      const polled = await store.poll(1000);
      expect(polled).toHaveLength(0);
    });
  });

  describe("poll atomicity", () => {
    it("should remove entries after poll so second poll returns empty", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      const first = await store.poll(300);
      expect(first).toHaveLength(2);

      const second = await store.poll(300);
      expect(second).toHaveLength(0);
    });
  });

  describe("cancel", () => {
    it("should cancel a scheduled entry", async () => {
      const entry = createEntry({ deliverAt: 100 });
      await store.schedule(entry);

      const cancelled = await store.cancel(entry.id);
      expect(cancelled).toBe(true);

      const polled = await store.poll(200);
      expect(polled).toHaveLength(0);
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

      await store.poll(150);
      expect(await store.size()).toBe(1);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      await store.clear();
      expect(await store.size()).toBe(0);

      const polled = await store.poll(999999);
      expect(polled).toHaveLength(0);
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
      const polled = await store.poll(200);

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
      const polled = await store.poll(200);

      expect(polled[0].envelope.topic).toBe("my-topic");
      expect(polled[0].envelope.headers).toEqual({ "x-custom": "value" });
      expect(polled[0].envelope.priority).toBe(5);
      expect(polled[0].envelope.replyTo).toBe("reply-queue");
      expect(polled[0].envelope.correlationId).toBe("corr-123");
    });
  });
});
