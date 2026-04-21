import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { DeadLetterEntry } from "../../types/dead-letter.js";
import { MemoryDeadLetterStore } from "./MemoryDeadLetterStore.js";
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

const createDlEntry = (overrides: Partial<DeadLetterEntry> = {}): DeadLetterEntry => ({
  id: "dl-1",
  envelope: createEnvelope(),
  topic: "test-topic",
  error: "Something went wrong",
  errorStack: "Error: Something went wrong\n    at test.ts:1",
  attempt: 3,
  timestamp: 1000,
  ...overrides,
});

describe("MemoryDeadLetterStore", () => {
  let store: MemoryDeadLetterStore;

  beforeEach(() => {
    store = new MemoryDeadLetterStore();
  });

  afterEach(async () => {
    await store.close();
  });

  describe("add", () => {
    it("should add an entry", async () => {
      await store.add(createDlEntry());
      expect(await store.count()).toBe(1);
    });

    it("should overwrite an entry with the same id", async () => {
      await store.add(createDlEntry({ id: "a", error: "first" }));
      await store.add(createDlEntry({ id: "a", error: "second" }));
      expect(await store.count()).toBe(1);
      const entry = await store.get("a");
      expect(entry?.error).toBe("second");
    });
  });

  describe("list", () => {
    it("should list all entries sorted by timestamp", async () => {
      await store.add(createDlEntry({ id: "c", timestamp: 3000 }));
      await store.add(createDlEntry({ id: "a", timestamp: 1000 }));
      await store.add(createDlEntry({ id: "b", timestamp: 2000 }));

      const result = await store.list();
      expect(result.map((e) => e.id)).toMatchSnapshot();
    });

    it("should filter by topic", async () => {
      await store.add(createDlEntry({ id: "a", topic: "orders", timestamp: 1000 }));
      await store.add(createDlEntry({ id: "b", topic: "users", timestamp: 2000 }));
      await store.add(createDlEntry({ id: "c", topic: "orders", timestamp: 3000 }));

      const result = await store.list({ topic: "orders" });
      expect(result.map((e) => e.id)).toMatchSnapshot();
    });

    it("should support pagination with limit and offset", async () => {
      await store.add(createDlEntry({ id: "a", timestamp: 1000 }));
      await store.add(createDlEntry({ id: "b", timestamp: 2000 }));
      await store.add(createDlEntry({ id: "c", timestamp: 3000 }));
      await store.add(createDlEntry({ id: "d", timestamp: 4000 }));

      const page = await store.list({ limit: 2, offset: 1 });
      expect(page.map((e) => e.id)).toMatchSnapshot();
    });

    it("should return empty array when no entries", async () => {
      const result = await store.list();
      expect(result).toMatchSnapshot();
    });
  });

  describe("get", () => {
    it("should return the entry by id", async () => {
      const entry = createDlEntry({ id: "x" });
      await store.add(entry);
      const result = await store.get("x");
      expect(result?.id).toBe("x");
      expect(result?.error).toBe(entry.error);
    });

    it("should return null for unknown id", async () => {
      expect(await store.get("nonexistent")).toBeNull();
    });
  });

  describe("remove", () => {
    it("should remove an entry and return true", async () => {
      await store.add(createDlEntry({ id: "a" }));
      expect(await store.remove("a")).toBe(true);
      expect(await store.count()).toBe(0);
    });

    it("should return false for unknown id", async () => {
      expect(await store.remove("nonexistent")).toBe(false);
    });
  });

  describe("purge", () => {
    it("should remove all entries when no topic filter", async () => {
      await store.add(createDlEntry({ id: "a", topic: "orders" }));
      await store.add(createDlEntry({ id: "b", topic: "users" }));
      const count = await store.purge();
      expect(count).toBe(2);
      expect(await store.count()).toBe(0);
    });

    it("should remove only entries matching topic", async () => {
      await store.add(createDlEntry({ id: "a", topic: "orders" }));
      await store.add(createDlEntry({ id: "b", topic: "users" }));
      await store.add(createDlEntry({ id: "c", topic: "orders" }));

      const count = await store.purge({ topic: "orders" });
      expect(count).toBe(2);
      expect(await store.count()).toBe(1);
    });

    it("should return 0 when nothing to purge", async () => {
      expect(await store.purge()).toBe(0);
    });
  });

  describe("count", () => {
    it("should return total count", async () => {
      await store.add(createDlEntry({ id: "a" }));
      await store.add(createDlEntry({ id: "b" }));
      expect(await store.count()).toBe(2);
    });

    it("should count by topic", async () => {
      await store.add(createDlEntry({ id: "a", topic: "orders" }));
      await store.add(createDlEntry({ id: "b", topic: "users" }));
      await store.add(createDlEntry({ id: "c", topic: "orders" }));
      expect(await store.count({ topic: "orders" })).toBe(2);
      expect(await store.count({ topic: "users" })).toBe(1);
    });

    it("should return 0 when empty", async () => {
      expect(await store.count()).toBe(0);
    });
  });

  describe("close", () => {
    it("should clear all entries", async () => {
      await store.add(createDlEntry({ id: "a" }));
      await store.close();
      expect(await store.count()).toBe(0);
    });
  });
});
