import type { IrisEnvelope } from "../types/iris-envelope";
import type { DelayedEntry } from "../../types/delay";
import { MemoryDelayStore } from "./MemoryDelayStore";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

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

describe("MemoryDelayStore", () => {
  let store: MemoryDelayStore;

  beforeEach(() => {
    store = new MemoryDelayStore();
  });

  afterEach(async () => {
    await store.close();
  });

  describe("schedule", () => {
    it("should schedule an entry", async () => {
      const entry = createEntry();
      await store.schedule(entry);
      expect(await store.size()).toBe(1);
    });

    it("should overwrite an entry with the same id", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 1000 }));
      await store.schedule(createEntry({ id: "a", deliverAt: 2000 }));
      expect(await store.size()).toBe(1);
    });
  });

  describe("poll", () => {
    it("should return entries with deliverAt <= now", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));
      await store.schedule(createEntry({ id: "c", deliverAt: 500 }));

      const result = await store.poll(200);
      expect(result.map((e) => e.id)).toMatchSnapshot();
      expect(await store.size()).toBe(1);
    });

    it("should return empty array when no entries are ready", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 1000 }));
      const result = await store.poll(500);
      expect(result).toMatchSnapshot();
      expect(await store.size()).toBe(1);
    });

    it("should return entries sorted by deliverAt", async () => {
      await store.schedule(createEntry({ id: "c", deliverAt: 300 }));
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      const result = await store.poll(500);
      expect(result.map((e) => e.id)).toMatchSnapshot();
    });

    it("should remove polled entries atomically", async () => {
      await store.schedule(createEntry({ id: "a", deliverAt: 100 }));
      await store.schedule(createEntry({ id: "b", deliverAt: 200 }));

      const first = await store.poll(150);
      expect(first).toHaveLength(1);

      const second = await store.poll(150);
      expect(second).toHaveLength(0);
    });
  });

  describe("cancel", () => {
    it("should cancel a scheduled entry", async () => {
      await store.schedule(createEntry({ id: "a" }));
      expect(await store.cancel("a")).toBe(true);
      expect(await store.size()).toBe(0);
    });

    it("should return false for unknown id", async () => {
      expect(await store.cancel("nonexistent")).toBe(false);
    });
  });

  describe("size", () => {
    it("should return the number of scheduled entries", async () => {
      await store.schedule(createEntry({ id: "a" }));
      await store.schedule(createEntry({ id: "b" }));
      expect(await store.size()).toBe(2);
    });

    it("should return 0 when empty", async () => {
      expect(await store.size()).toBe(0);
    });
  });

  describe("clear", () => {
    it("should remove all entries", async () => {
      await store.schedule(createEntry({ id: "a" }));
      await store.schedule(createEntry({ id: "b" }));
      await store.clear();
      expect(await store.size()).toBe(0);
    });
  });

  describe("close", () => {
    it("should clear all entries", async () => {
      await store.schedule(createEntry({ id: "a" }));
      await store.close();
      expect(await store.size()).toBe(0);
    });
  });
});
