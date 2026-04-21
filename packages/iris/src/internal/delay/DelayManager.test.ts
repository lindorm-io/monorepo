import type { ILogger } from "@lindorm/logger";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import { DelayManager } from "./DelayManager.js";
import { MemoryDelayStore } from "./MemoryDelayStore.js";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const createLogger = (): ILogger =>
  ({
    child: vi.fn().mockReturnThis(),
    debug: vi.fn(),
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  }) as unknown as ILogger;

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

describe("DelayManager", () => {
  let store: MemoryDelayStore;
  let logger: ILogger;
  let manager: DelayManager;

  beforeEach(() => {
    store = new MemoryDelayStore();
    logger = createLogger();
    manager = new DelayManager({ store, logger, pollIntervalMs: 10 });
  });

  afterEach(async () => {
    await manager.close();
  });

  describe("schedule", () => {
    it("should schedule an entry and return an id", async () => {
      const id = await manager.schedule(createEnvelope(), "orders", 5000);
      expect(typeof id).toBe("string");
      expect(id.length).toBeGreaterThan(0);
      expect(await manager.size()).toBe(1);
    });
  });

  describe("cancel", () => {
    it("should cancel a scheduled entry", async () => {
      const id = await manager.schedule(createEnvelope(), "orders", 5000);
      expect(await manager.cancel(id)).toBe(true);
      expect(await manager.size()).toBe(0);
    });

    it("should return false for unknown id", async () => {
      expect(await manager.cancel("nonexistent")).toBe(false);
    });
  });

  describe("start / stop", () => {
    it("should deliver entries when their time comes", async () => {
      const delivered: Array<string> = [];

      // Schedule with 0 delay so it's immediately ready
      await store.schedule({
        id: "test-1",
        envelope: createEnvelope(),
        topic: "orders",
        deliverAt: Date.now() - 1,
      });

      manager.start(async (entry) => {
        delivered.push(entry.id);
      });

      // Wait for polling to pick it up
      await new Promise((r) => setTimeout(r, 50));

      expect(delivered).toEqual(["test-1"]);
      expect(await store.size()).toBe(0);
    });

    it("should not crash the loop when callback throws", async () => {
      await store.schedule({
        id: "fail-1",
        envelope: createEnvelope(),
        topic: "orders",
        deliverAt: Date.now() - 1,
      });

      await store.schedule({
        id: "ok-1",
        envelope: createEnvelope(),
        topic: "orders",
        deliverAt: Date.now() - 1,
      });

      const delivered: Array<string> = [];

      manager.start(async (entry) => {
        if (entry.id === "fail-1") {
          throw new Error("boom");
        }
        delivered.push(entry.id);
      });

      await new Promise((r) => setTimeout(r, 50));

      // Both should have been attempted; ok-1 should succeed
      expect(delivered).toEqual(["ok-1"]);
      expect(await store.size()).toBe(0);
    });

    it("should not leak interval handles when start() is called twice", async () => {
      const delivered: Array<string> = [];

      await store.schedule({
        id: "double-start-1",
        envelope: createEnvelope(),
        topic: "orders",
        deliverAt: Date.now() - 1,
      });

      manager.start(async (entry) => {
        delivered.push(entry.id);
      });

      // Second start should be a no-op (guard returns early)
      manager.start(async (entry) => {
        delivered.push(entry.id);
        delivered.push(entry.id); // double-push to detect if second callback was used
      });

      await new Promise((r) => setTimeout(r, 50));

      // Entry should be delivered exactly once — the first callback wins
      expect(delivered).toEqual(["double-start-1"]);
    });

    it("should stop polling after stop()", async () => {
      const delivered: Array<string> = [];

      manager.start(async (entry) => {
        delivered.push(entry.id);
      });

      manager.stop();

      await store.schedule({
        id: "after-stop",
        envelope: createEnvelope(),
        topic: "orders",
        deliverAt: Date.now() - 1,
      });

      await new Promise((r) => setTimeout(r, 50));

      // Should not have been delivered because polling stopped
      expect(delivered).toHaveLength(0);
    });
  });

  describe("size", () => {
    it("should delegate to store", async () => {
      await manager.schedule(createEnvelope(), "a", 5000);
      await manager.schedule(createEnvelope(), "b", 5000);
      expect(await manager.size()).toBe(2);
    });
  });

  describe("close", () => {
    it("should stop polling and close store", async () => {
      manager.start(async () => {});
      await manager.close();
      expect(await store.size()).toBe(0);
    });
  });
});
