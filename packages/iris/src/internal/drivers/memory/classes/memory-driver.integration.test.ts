import type { IMessage, IMessageSubscriber } from "../../../../interfaces/index.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { Retry } from "../../../../decorators/Retry.js";
import { DeadLetter } from "../../../../decorators/DeadLetter.js";
import { BeforePublish } from "../../../../decorators/BeforePublish.js";
import { AfterPublish } from "../../../../decorators/AfterPublish.js";
import { BeforeConsume } from "../../../../decorators/BeforeConsume.js";
import { AfterConsume } from "../../../../decorators/AfterConsume.js";
import { OnConsumeError } from "../../../../decorators/OnConsumeError.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import { MemoryDeadLetterStore } from "../../../dead-letter/MemoryDeadLetterStore.js";
import { IrisSource } from "../../../../classes/IrisSource.js";
import { MemoryDriver } from "./MemoryDriver.js";
import { beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckIntBasic" })
class TckIntBasic implements IMessage {
  @Field("string") body!: string;
}

@Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
@DeadLetter()
@Message({ name: "TckIntRetry" })
class TckIntRetry implements IMessage {
  @Field("string") data!: string;
}

const intHookLog: Array<string> = [];

@BeforePublish(() => {
  intHookLog.push("beforePublish");
})
@AfterPublish(() => {
  intHookLog.push("afterPublish");
})
@BeforeConsume(() => {
  intHookLog.push("beforeConsume");
})
@AfterConsume(() => {
  intHookLog.push("afterConsume");
})
@OnConsumeError((err: Error) => {
  intHookLog.push(`error:${err.message}`);
})
@Message({ name: "TckIntHook" })
class TckIntHook implements IMessage {
  @Field("string") body!: string;
}

// --- Helpers ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

// --- Tests ---

describe("Memory Driver Integration", () => {
  beforeEach(() => {
    clearRegistry();
    intHookLog.length = 0;
    vi.useRealTimers();
  });

  describe("IrisSource wiring", () => {
    it("should connect with driver='memory'", async () => {
      const source = new IrisSource({
        driver: "memory",
        logger: createMockLogger() as any,
      });

      await source.connect();
      expect(await source.ping()).toBe(true);
      await source.disconnect();
    });

    it("should create working message bus through IrisSource", async () => {
      const source = new IrisSource({
        driver: "memory",
        logger: createMockLogger() as any,
      });

      await source.connect();
      await source.setup();

      const bus = source.messageBus(TckIntBasic);
      const received: Array<any> = [];
      await bus.subscribe({
        topic: "TckIntBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "integration" } as any);
      await bus.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("integration");

      await source.disconnect();
    });
  });

  describe("full publish-subscribe cycle", () => {
    it("should publish and receive through real serialization pipeline", async () => {
      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });

      const bus = driver.createMessageBus(TckIntBasic);
      const received: Array<any> = [];
      await bus.subscribe({
        topic: "TckIntBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "full-cycle" } as any);
      await bus.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0]).toMatchSnapshot({
        body: "full-cycle",
      });
    });

    it("should fire all hooks in correct order", async () => {
      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });

      const bus = driver.createMessageBus(TckIntHook);
      await bus.subscribe({
        topic: "TckIntHook",
        callback: async () => {
          /* consume successfully */
        },
      });

      const msg = bus.create({ body: "hooks-test" } as any);
      await bus.publish(msg);

      expect(intHookLog).toMatchSnapshot();
    });
  });

  describe("shared store between clones", () => {
    it("should see messages from clone in original's subscriber", async () => {
      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });

      // Subscribe on original driver
      const bus = driver.createMessageBus(TckIntBasic);
      const received: Array<any> = [];
      await bus.subscribe({
        topic: "TckIntBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Clone the driver and publish from the clone
      const clonedSubs: Array<IMessageSubscriber> = [];
      const cloned = driver.cloneWithGetters(() => clonedSubs);
      const clonedPublisher = cloned.createPublisher(TckIntBasic);
      const msg = clonedPublisher.create({ body: "from-clone" } as any);
      await clonedPublisher.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("from-clone");
    });
  });

  describe("retry to dead letter", () => {
    it("should retry and then dead-letter after max retries", async () => {
      vi.useFakeTimers();

      const logger = createMockLogger();
      const deadLetterManager = new DeadLetterManager({
        store: new MemoryDeadLetterStore(),
        logger: logger as any,
      });

      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: logger as any,
        getSubscribers: () => subs,
        deadLetterManager,
      });

      let callCount = 0;
      const bus = driver.createMessageBus(TckIntRetry);
      await bus.subscribe({
        topic: "TckIntRetry",
        callback: async () => {
          callCount++;
          throw new Error("always-fail");
        },
      });

      const msg = bus.create({ data: "retry-me" } as any);
      await bus.publish(msg);

      // Initial attempt (attempt=0) fails
      expect(callCount).toBe(1);

      // Advance timer for retry 1 (attempt=1)
      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(2);

      // Advance timer for retry 2 (attempt=2, which is maxRetries)
      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(3);

      // Should be dead-lettered now (attempt 2 === maxRetries 2, no more retries)
      const deadLetters = await deadLetterManager.list();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].topic).toBe("TckIntRetry");
    });
  });

  describe("publisher interface shape", () => {
    it("should expose write-only methods (no subscribe/unsubscribe)", async () => {
      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });

      const pub = driver.createPublisher(TckIntBasic);

      // Write-only methods must exist
      expect(typeof pub.create).toBe("function");
      expect(typeof pub.publish).toBe("function");
      expect(typeof pub.hydrate).toBe("function");
      expect(typeof pub.copy).toBe("function");
      expect(typeof pub.validate).toBe("function");

      // Subscription methods must NOT exist on publisher
      expect((pub as any).subscribe).toBeUndefined();
      expect((pub as any).unsubscribe).toBeUndefined();
      expect((pub as any).unsubscribeAll).toBeUndefined();
    });
  });

  describe("create / hydrate / copy / validate", () => {
    let driver: MemoryDriver;

    beforeEach(() => {
      const subs: Array<IMessageSubscriber> = [];
      driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });
    });

    describe("on messageBus", () => {
      it("should create a message with provided fields", () => {
        const bus = driver.createMessageBus(TckIntBasic);
        const msg = bus.create({ body: "hello" } as any);
        expect(msg.body).toBe("hello");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should hydrate a message from raw data", () => {
        const bus = driver.createMessageBus(TckIntBasic);
        const msg = bus.hydrate({ body: "hydrated" });
        expect(msg.body).toBe("hydrated");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should copy a message as a deep clone", () => {
        const bus = driver.createMessageBus(TckIntBasic);
        const original = bus.create({ body: "original" } as any);
        const copied = bus.copy(original);

        expect(copied.body).toBe("original");
        expect(copied).toBeInstanceOf(TckIntBasic);
        expect(copied).not.toBe(original);

        // Mutating the copy must not affect the original
        (copied as any).body = "mutated";
        expect(original.body).toBe("original");
      });

      it("should validate a valid message without throwing", () => {
        const bus = driver.createMessageBus(TckIntBasic);
        const msg = bus.create({ body: "valid" } as any);
        expect(() => bus.validate(msg)).not.toThrow();
      });

      it("should throw on invalid message (wrong type)", () => {
        const bus = driver.createMessageBus(TckIntBasic);
        const msg = bus.create({ body: "valid" } as any);
        (msg as any).body = 12345; // wrong type: number instead of string
        expect(() => bus.validate(msg)).toThrow();
      });
    });

    describe("on publisher", () => {
      it("should create a message", () => {
        const pub = driver.createPublisher(TckIntBasic);
        const msg = pub.create({ body: "pub-create" } as any);
        expect(msg.body).toBe("pub-create");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should publish a message without error", async () => {
        const pub = driver.createPublisher(TckIntBasic);
        const msg = pub.create({ body: "pub-publish" } as any);
        await expect(pub.publish(msg)).resolves.toBeUndefined();
      });

      it("should hydrate a message from raw data", () => {
        const pub = driver.createPublisher(TckIntBasic);
        const msg = pub.hydrate({ body: "pub-hydrated" });
        expect(msg.body).toBe("pub-hydrated");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should copy a message as a deep clone", () => {
        const pub = driver.createPublisher(TckIntBasic);
        const original = pub.create({ body: "pub-original" } as any);
        const copied = pub.copy(original);
        expect(copied.body).toBe("pub-original");
        expect(copied).not.toBe(original);
      });

      it("should validate a valid message without throwing", () => {
        const pub = driver.createPublisher(TckIntBasic);
        const msg = pub.create({ body: "valid" } as any);
        expect(() => pub.validate(msg)).not.toThrow();
      });
    });

    describe("on workerQueue", () => {
      it("should create a message", () => {
        const wq = driver.createWorkerQueue(TckIntBasic);
        const msg = wq.create({ body: "wq-create" } as any);
        expect(msg.body).toBe("wq-create");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should publish a message without error", async () => {
        const wq = driver.createWorkerQueue(TckIntBasic);
        const msg = wq.create({ body: "wq-publish" } as any);
        await expect(wq.publish(msg)).resolves.toBeUndefined();
      });

      it("should hydrate a message from raw data", () => {
        const wq = driver.createWorkerQueue(TckIntBasic);
        const msg = wq.hydrate({ body: "wq-hydrated" });
        expect(msg.body).toBe("wq-hydrated");
        expect(msg).toBeInstanceOf(TckIntBasic);
      });

      it("should copy a message as a deep clone", () => {
        const wq = driver.createWorkerQueue(TckIntBasic);
        const original = wq.create({ body: "wq-original" } as any);
        const copied = wq.copy(original);
        expect(copied.body).toBe("wq-original");
        expect(copied).not.toBe(original);
      });

      it("should validate a valid message without throwing", () => {
        const wq = driver.createWorkerQueue(TckIntBasic);
        const msg = wq.create({ body: "valid" } as any);
        expect(() => wq.validate(msg)).not.toThrow();
      });
    });
  });

  describe("worker queue competing consumers", () => {
    it("should distribute messages evenly across consumers", async () => {
      const subs: Array<IMessageSubscriber> = [];
      const driver = new MemoryDriver({
        logger: createMockLogger() as any,
        getSubscribers: () => subs,
      });

      const queue = driver.createWorkerQueue(TckIntBasic);

      const received1: Array<any> = [];
      const received2: Array<any> = [];

      await queue.consume("TckIntBasic", async (msg) => {
        received1.push(msg);
      });
      await queue.consume("TckIntBasic", async (msg) => {
        received2.push(msg);
      });

      // Publish 4 messages
      for (let i = 0; i < 4; i++) {
        const msg = queue.create({ body: `msg-${i}` } as any);
        await queue.publish(msg);
      }

      // Round-robin should distribute evenly: 2 each
      expect(received1).toHaveLength(2);
      expect(received2).toHaveLength(2);

      expect(received1[0].body).toBe("msg-0");
      expect(received2[0].body).toBe("msg-1");
      expect(received1[1].body).toBe("msg-2");
      expect(received2[1].body).toBe("msg-3");
    });
  });
});
