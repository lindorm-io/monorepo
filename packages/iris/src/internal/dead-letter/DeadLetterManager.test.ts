import type { ILogger } from "@lindorm/logger";
import type { IrisEnvelope } from "../types/iris-envelope";
import { DeadLetterManager } from "./DeadLetterManager";
import { MemoryDeadLetterStore } from "./MemoryDeadLetterStore";

const createLogger = (): ILogger =>
  ({
    child: jest.fn().mockReturnThis(),
    debug: jest.fn(),
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
  }) as unknown as ILogger;

const createEnvelope = (overrides: Partial<IrisEnvelope> = {}): IrisEnvelope => ({
  topic: "test-topic",
  payload: Buffer.from("test"),
  headers: {},
  priority: 0,
  timestamp: Date.now(),
  expiry: null,
  broadcast: false,
  attempt: 3,
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

describe("DeadLetterManager", () => {
  let store: MemoryDeadLetterStore;
  let logger: ILogger;
  let manager: DeadLetterManager;

  beforeEach(() => {
    store = new MemoryDeadLetterStore();
    logger = createLogger();
    manager = new DeadLetterManager({ store, logger });
  });

  afterEach(async () => {
    await manager.close();
  });

  describe("send", () => {
    it("should add an entry to the dead letter store", async () => {
      const error = new Error("Processing failed");
      const id = await manager.send(createEnvelope(), "orders", error);

      expect(typeof id).toBe("string");
      expect(await manager.count()).toBe(1);

      const entry = await manager.get(id);
      expect(entry).not.toBeNull();
      expect(entry!.error).toBe("Processing failed");
      expect(entry!.topic).toBe("orders");
      expect(entry!.attempt).toBe(3);
    });

    it("should handle errors without a stack", async () => {
      const error = new Error("no stack");
      error.stack = undefined;

      const id = await manager.send(createEnvelope(), "orders", error);
      const entry = await manager.get(id);
      expect(entry!.errorStack).toBeNull();
    });

    it("should log a warning", async () => {
      await manager.send(createEnvelope(), "orders", new Error("fail"));
      expect(logger.child("" as never).warn).toHaveBeenCalled();
    });
  });

  describe("list", () => {
    it("should delegate to store", async () => {
      await manager.send(createEnvelope(), "orders", new Error("a"));
      await manager.send(createEnvelope(), "users", new Error("b"));

      const all = await manager.list();
      expect(all).toHaveLength(2);

      const filtered = await manager.list({ topic: "orders" });
      expect(filtered).toHaveLength(1);
    });
  });

  describe("get", () => {
    it("should return entry by id", async () => {
      const id = await manager.send(createEnvelope(), "orders", new Error("fail"));
      const entry = await manager.get(id);
      expect(entry).not.toBeNull();
    });

    it("should return null for unknown id", async () => {
      expect(await manager.get("nonexistent")).toBeNull();
    });
  });

  describe("remove", () => {
    it("should remove an entry", async () => {
      const id = await manager.send(createEnvelope(), "orders", new Error("fail"));
      expect(await manager.remove(id)).toBe(true);
      expect(await manager.count()).toBe(0);
    });

    it("should return false for unknown id", async () => {
      expect(await manager.remove("nonexistent")).toBe(false);
    });
  });

  describe("purge", () => {
    it("should purge all entries", async () => {
      await manager.send(createEnvelope(), "orders", new Error("a"));
      await manager.send(createEnvelope(), "users", new Error("b"));

      const count = await manager.purge();
      expect(count).toBe(2);
      expect(await manager.count()).toBe(0);
    });

    it("should purge by topic", async () => {
      await manager.send(createEnvelope(), "orders", new Error("a"));
      await manager.send(createEnvelope(), "users", new Error("b"));

      const count = await manager.purge({ topic: "orders" });
      expect(count).toBe(1);
      expect(await manager.count()).toBe(1);
    });
  });

  describe("count", () => {
    it("should delegate to store", async () => {
      await manager.send(createEnvelope(), "orders", new Error("a"));
      expect(await manager.count()).toBe(1);
    });
  });

  describe("close", () => {
    it("should close the store", async () => {
      await manager.send(createEnvelope(), "orders", new Error("a"));
      await manager.close();
      expect(await store.count()).toBe(0);
    });
  });
});
