import type { IMessage } from "../../../../interfaces/index.js";
import { AfterConsume } from "../../../../decorators/AfterConsume.js";
import { AfterPublish } from "../../../../decorators/AfterPublish.js";
import { BeforeConsume } from "../../../../decorators/BeforeConsume.js";
import { BeforePublish } from "../../../../decorators/BeforePublish.js";
import { DeadLetter } from "../../../../decorators/DeadLetter.js";
import { Field } from "../../../../decorators/Field.js";
import { Message } from "../../../../decorators/Message.js";
import { OnConsumeError } from "../../../../decorators/OnConsumeError.js";
import { Retry } from "../../../../decorators/Retry.js";
import { Expiry } from "../../../../decorators/Expiry.js";
import { Topic } from "../../../../decorators/Topic.js";
import { clearRegistry } from "../../../message/metadata/registry.js";
import { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import { MemoryDeadLetterStore } from "../../../dead-letter/MemoryDeadLetterStore.js";
import { createStore } from "../utils/create-store.js";
import { MemoryMessageBus } from "./MemoryMessageBus.js";
import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// --- Mock logger ---

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

// --- Message classes (module-level for metadata registration) ---

@Message({ name: "TckBusBasic" })
class TckBusBasic implements IMessage {
  @Field("string") body!: string;
}

@Retry({ maxRetries: 3, strategy: "constant", delay: 100 })
@DeadLetter()
@Message({ name: "TckBusRetryFixed" })
class TckBusRetryFixed implements IMessage {
  @Field("string") data!: string;
}

@Retry({ maxRetries: 2, strategy: "exponential", delay: 50 })
@DeadLetter()
@Message({ name: "TckBusRetryExp" })
class TckBusRetryExp implements IMessage {
  @Field("string") data!: string;
}

@Expiry(500)
@Message({ name: "TckBusExpiry" })
class TckBusExpiry implements IMessage {
  @Field("string") body!: string;
}

@Topic((msg: any) => `events.${msg.category}`)
@Message({ name: "TckBusTopic" })
class TckBusTopic implements IMessage {
  @Field("string") category!: string;
  @Field("string") data!: string;
}

const hookLog: Array<string> = [];

@BeforePublish((msg: any) => {
  hookLog.push("beforePublish");
})
@AfterPublish((msg: any) => {
  hookLog.push("afterPublish");
})
@BeforeConsume((msg: any) => {
  hookLog.push("beforeConsume");
})
@AfterConsume((msg: any) => {
  hookLog.push("afterConsume");
})
@OnConsumeError((err: Error) => {
  hookLog.push(`onConsumeError:${err.message}`);
})
@Message({ name: "TckBusHook" })
class TckBusHook implements IMessage {
  @Field("string") body!: string;
}

@Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
@Message({ name: "TckBusNoDeadLetter" })
class TckBusNoDeadLetter implements IMessage {
  @Field("string") data!: string;
}

// --- Helpers ---

const createBus = <M extends IMessage>(target: new () => M) => {
  const store = createStore();
  const logger = createMockLogger();
  const deadLetterManager = new DeadLetterManager({
    store: new MemoryDeadLetterStore(),
    logger: logger as any,
  });
  const bus = new MemoryMessageBus<M>({
    target: target as any,
    logger: logger as any,
    getSubscribers: () => [],
    store,
    deadLetterManager,
  });
  return { bus, store, deadLetterManager };
};

// --- Tests ---

beforeEach(() => {
  clearRegistry();
  hookLog.length = 0;
});

describe("MemoryMessageBus", () => {
  describe("publish and subscribe", () => {
    it("should deliver published message to subscriber", async () => {
      const { bus } = createBus(TckBusBasic);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("hello");
    });

    it("should fan-out to multiple subscribers on same topic", async () => {
      const { bus } = createBus(TckBusBasic);
      const received_a: Array<string> = [];
      const received_b: Array<string> = [];

      // Both subscribers have no queue (broadcast mode)
      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received_a.push("a");
        },
      });
      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received_b.push("b");
        },
      });

      await bus.publish(bus.create({ body: "test" }));

      expect(received_a).toHaveLength(1);
      expect(received_b).toHaveLength(1);
    });

    it("should not deliver to subscribers on different topic", async () => {
      const { bus } = createBus(TckBusBasic);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "OtherTopic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await bus.publish(bus.create({ body: "test" }));

      expect(received).toHaveLength(0);
    });
  });

  describe("queue grouping", () => {
    it("should round-robin among subscribers in the same queue", async () => {
      const { bus } = createBus(TckBusBasic);
      const received_a: Array<string> = [];
      const received_b: Array<string> = [];

      await bus.subscribe({
        topic: "TckBusBasic",
        queue: "q1",
        callback: async () => {
          received_a.push("a");
        },
      });
      await bus.subscribe({
        topic: "TckBusBasic",
        queue: "q1",
        callback: async () => {
          received_b.push("b");
        },
      });

      for (let i = 0; i < 4; i++) {
        await bus.publish(bus.create({ body: `msg${i}` }));
      }

      expect(received_a).toHaveLength(2);
      expect(received_b).toHaveLength(2);
    });

    it("should deliver to all broadcast (queue=null) subscribers plus one per queue", async () => {
      const { bus } = createBus(TckBusBasic);
      const broadcastHits: Array<string> = [];
      const queueHits: Array<string> = [];

      // Broadcast subscriber (no queue)
      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          broadcastHits.push("broadcast");
        },
      });

      // Queue subscriber
      await bus.subscribe({
        topic: "TckBusBasic",
        queue: "q1",
        callback: async () => {
          queueHits.push("queue");
        },
      });

      await bus.publish(bus.create({ body: "test" }));

      expect(broadcastHits).toHaveLength(1);
      expect(queueHits).toHaveLength(1);
    });
  });

  describe("unsubscribe", () => {
    it("should remove subscription by topic", async () => {
      const { bus } = createBus(TckBusBasic);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await bus.unsubscribe({ topic: "TckBusBasic" });
      await bus.publish(bus.create({ body: "test" }));

      expect(received).toHaveLength(0);
    });

    it("should remove subscription by topic + queue", async () => {
      const { bus, store } = createBus(TckBusBasic);
      const received_queue: Array<string> = [];
      const received_broadcast: Array<string> = [];

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received_broadcast.push("broadcast");
        },
      });
      await bus.subscribe({
        topic: "TckBusBasic",
        queue: "q1",
        callback: async () => {
          received_queue.push("queue");
        },
      });

      // Remove only the queue subscriber
      await bus.unsubscribe({ topic: "TckBusBasic", queue: "q1" });
      await bus.publish(bus.create({ body: "test" }));

      // Broadcast subscriber should still receive
      expect(received_broadcast).toHaveLength(1);
      // Queue subscriber should not receive
      expect(received_queue).toHaveLength(0);
    });

    it("should only remove own subscriptions", async () => {
      const store = createStore();
      const bus1 = new MemoryMessageBus({
        target: TckBusBasic as any,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const bus2 = new MemoryMessageBus({
        target: TckBusBasic as any,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      const received1: Array<string> = [];
      const received2: Array<string> = [];

      await bus1.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received1.push("bus1");
        },
      });
      await bus2.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received2.push("bus2");
        },
      });

      // bus1 unsubscribes — bus2 should remain
      await bus1.unsubscribe({ topic: "TckBusBasic" });
      await bus2.publish(bus2.create({ body: "test" }));

      expect(received1).toHaveLength(0);
      expect(received2).toHaveLength(1);
    });

    it("should clean ownedConsumerTags on unsubscribe", async () => {
      const { bus, store } = createBus(TckBusBasic);

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {},
      });

      expect(store.subscriptions).toHaveLength(1);
      expect(typeof store.subscriptions[0].consumerTag).toBe("string");

      await bus.unsubscribe({ topic: "TckBusBasic" });

      expect(store.subscriptions).toHaveLength(0);
    });
  });

  describe("unsubscribeAll", () => {
    it("should remove all owned subscriptions", async () => {
      const { bus, store } = createBus(TckBusBasic);

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {},
      });
      await bus.subscribe({
        topic: "TckBusBasic",
        queue: "q1",
        callback: async () => {},
      });

      expect(store.subscriptions).toHaveLength(2);

      await bus.unsubscribeAll();

      expect(store.subscriptions).toHaveLength(0);
    });

    it("should not affect other instances subscriptions", async () => {
      const store = createStore();
      const bus1 = new MemoryMessageBus({
        target: TckBusBasic as any,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const bus2 = new MemoryMessageBus({
        target: TckBusBasic as any,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      await bus1.subscribe({
        topic: "TckBusBasic",
        callback: async () => {},
      });
      await bus2.subscribe({
        topic: "TckBusBasic",
        callback: async () => {},
      });

      expect(store.subscriptions).toHaveLength(2);

      await bus1.unsubscribeAll();

      expect(store.subscriptions).toHaveLength(1);
    });
  });

  describe("expiry", () => {
    // TODO: add a proper expiry test that creates an already-expired envelope and verifies it is skipped by consumeMessageCore
    it("should publish message with delay and expiry options without crashing", async () => {
      vi.useFakeTimers();

      try {
        const { bus } = createBus(TckBusExpiry);
        let received = false;

        await bus.subscribe({
          topic: "TckBusExpiry",
          callback: async () => {
            received = true;
          },
        });

        const msg = bus.create({ body: "hello" });
        // Without a delayManager, delay > 0 falls back to immediate dispatch
        // so expiry is tested via the envelope's timestamp + expiry fields
        await bus.publish(msg, { delay: 1000 });

        // Without delayManager, message dispatches immediately — not expired yet
        // This test just verifies publish doesn't crash with delay + expiry
        expect(received).toBe(true);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("retry with fixed backoff", () => {
    it("should retry on callback error", async () => {
      vi.useFakeTimers();

      try {
        const { bus } = createBus(TckBusRetryFixed);
        let attempts = 0;

        await bus.subscribe({
          topic: "TckBusRetryFixed",
          callback: async () => {
            attempts++;
            throw new Error("fail");
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        // First attempt happened synchronously
        expect(attempts).toBe(1);

        // Advance for retry 1 (100ms fixed)
        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(2);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should succeed if callback works on retry", async () => {
      vi.useFakeTimers();

      try {
        const { bus, deadLetterManager } = createBus(TckBusRetryFixed);
        let attempts = 0;

        await bus.subscribe({
          topic: "TckBusRetryFixed",
          callback: async () => {
            attempts++;
            if (attempts < 3) {
              throw new Error("fail");
            }
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        expect(attempts).toBe(1);

        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(2);

        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(3);

        // No more retries needed — should not dead-letter
        const deadLetters = await deadLetterManager.list();
        expect(deadLetters).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should stop after maxRetries", async () => {
      vi.useFakeTimers();

      try {
        const { bus } = createBus(TckBusRetryFixed);
        let attempts = 0;

        await bus.subscribe({
          topic: "TckBusRetryFixed",
          callback: async () => {
            attempts++;
            throw new Error("fail");
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        // First attempt
        expect(attempts).toBe(1);

        // Advance through all 3 retries
        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(2);
        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(3);
        await vi.advanceTimersByTimeAsync(100);
        expect(attempts).toBe(4); // original + 3 retries

        // No further retries after max
        await vi.advanceTimersByTimeAsync(1000);
        expect(attempts).toBe(4);
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("retry with exponential backoff", () => {
    it("should use increasing delays", async () => {
      vi.useFakeTimers();

      try {
        const { bus } = createBus(TckBusRetryExp);
        let attempts = 0;

        await bus.subscribe({
          topic: "TckBusRetryExp",
          callback: async () => {
            attempts++;
            throw new Error("fail");
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        // First attempt synchronous
        expect(attempts).toBe(1);

        // Retry 1: attempt=1, delay = 50 * 2^0 = 50ms
        await vi.advanceTimersByTimeAsync(50);
        expect(attempts).toBe(2);

        // Retry 2: attempt=2, delay = 50 * 2^1 = 100ms
        await vi.advanceTimersByTimeAsync(99);
        expect(attempts).toBe(2); // Not yet
        await vi.advanceTimersByTimeAsync(1);
        expect(attempts).toBe(3); // Now
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("dead letter", () => {
    it("should dead-letter after max retries when enabled", async () => {
      vi.useFakeTimers();

      try {
        const { bus, deadLetterManager } = createBus(TckBusRetryFixed);

        await bus.subscribe({
          topic: "TckBusRetryFixed",
          callback: async () => {
            throw new Error("permanent failure");
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        // Advance through all retries
        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersByTimeAsync(100);
        }

        const deadLetters = await deadLetterManager.list();
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].error).toBe("permanent failure");
        expect(deadLetters[0].topic).toBe("TckBusRetryFixed");
      } finally {
        vi.useRealTimers();
      }
    });

    it("should not dead-letter when not enabled", async () => {
      vi.useFakeTimers();

      try {
        const store = createStore();
        const logger = createMockLogger();
        const deadLetterManager = new DeadLetterManager({
          store: new MemoryDeadLetterStore(),
          logger: logger as any,
        });
        const bus = new MemoryMessageBus({
          target: TckBusNoDeadLetter as any,
          logger: logger as any,
          getSubscribers: () => [],
          store,
          deadLetterManager,
        });

        await bus.subscribe({
          topic: "TckBusNoDeadLetter",
          callback: async () => {
            throw new Error("fail");
          },
        });

        const msg = bus.create({ data: "test" });
        await bus.publish(msg);

        // Advance through all retries (maxRetries: 2)
        await vi.advanceTimersByTimeAsync(50);
        await vi.advanceTimersByTimeAsync(50);

        const deadLetters = await deadLetterManager.list();
        expect(deadLetters).toHaveLength(0);
      } finally {
        vi.useRealTimers();
      }
    });

    it("should preserve error in dead letter entry", async () => {
      vi.useFakeTimers();

      try {
        const { bus, deadLetterManager } = createBus(TckBusRetryFixed);

        await bus.subscribe({
          topic: "TckBusRetryFixed",
          callback: async () => {
            throw new Error("specific error message");
          },
        });

        await bus.publish(bus.create({ data: "test" }));

        for (let i = 0; i < 3; i++) {
          await vi.advanceTimersByTimeAsync(100);
        }

        const deadLetters = await deadLetterManager.list();
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].error).toBe("specific error message");
        expect(deadLetters[0].timestamp).toEqual(expect.any(Number));
      } finally {
        vi.useRealTimers();
      }
    });
  });

  describe("hooks", () => {
    it("should fire hooks in correct order for publish+subscribe", async () => {
      const { bus } = createBus(TckBusHook);

      await bus.subscribe({
        topic: "TckBusHook",
        callback: async () => {},
      });

      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);

      expect(hookLog).toEqual([
        "beforePublish",
        "beforeConsume",
        "afterConsume",
        "afterPublish",
      ]);
    });

    it("should fire onConsumeError when callback throws", async () => {
      const { bus } = createBus(TckBusHook);

      await bus.subscribe({
        topic: "TckBusHook",
        callback: async () => {
          throw new Error("boom");
        },
      });

      const msg = bus.create({ body: "hello" });
      await bus.publish(msg);

      expect(hookLog).toContain("beforePublish");
      expect(hookLog).toContain("beforeConsume");
      expect(hookLog).toContain("onConsumeError:boom");
    });
  });

  describe("topic resolution", () => {
    it("should use @Topic callback for routing", async () => {
      const { bus } = createBus(TckBusTopic);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "events.orders",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // This should NOT be received (different topic)
      await bus.subscribe({
        topic: "events.users",
        callback: async () => {
          received.push("wrong-topic");
        },
      });

      const msg = bus.create({ category: "orders", data: "test" });
      await bus.publish(msg);

      expect(received).toHaveLength(1);
      expect(received[0].category).toBe("orders");
    });

    it("should use message name as fallback", async () => {
      const { bus } = createBus(TckBusBasic);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await bus.publish(bus.create({ body: "test" }));

      expect(received).toHaveLength(1);
    });
  });

  describe("array subscribe", () => {
    it("should accept an array of subscriptions", async () => {
      const { bus } = createBus(TckBusBasic);
      const received_a: Array<string> = [];
      const received_b: Array<string> = [];

      await bus.subscribe([
        {
          topic: "TckBusBasic",
          queue: "q1",
          callback: async () => {
            received_a.push("a");
          },
        },
        {
          topic: "TckBusBasic",
          queue: "q2",
          callback: async () => {
            received_b.push("b");
          },
        },
      ]);

      await bus.publish(bus.create({ body: "test" }));

      expect(received_a).toHaveLength(1);
      expect(received_b).toHaveLength(1);
    });

    it("should register all subscriptions from array in store", async () => {
      const { bus, store } = createBus(TckBusBasic);

      await bus.subscribe([
        {
          topic: "TckBusBasic",
          callback: async () => {},
        },
        {
          topic: "TckBusBasic",
          queue: "q1",
          callback: async () => {},
        },
        {
          topic: "TckBusBasic",
          queue: "q2",
          callback: async () => {},
        },
      ]);

      expect(store.subscriptions).toHaveLength(3);
    });

    it("should handle empty array without error", async () => {
      const { bus, store } = createBus(TckBusBasic);

      await bus.subscribe([]);

      expect(store.subscriptions).toHaveLength(0);
    });

    it("should unsubscribeAll after array subscribe", async () => {
      const { bus, store } = createBus(TckBusBasic);

      await bus.subscribe([
        {
          topic: "TckBusBasic",
          callback: async () => {},
        },
        {
          topic: "TckBusBasic",
          queue: "q1",
          callback: async () => {},
        },
      ]);

      expect(store.subscriptions).toHaveLength(2);

      await bus.unsubscribeAll();

      expect(store.subscriptions).toHaveLength(0);
    });
  });

  describe("delayed publish", () => {
    it("should dispatch immediately when no delayManager is configured", async () => {
      const { bus } = createBus(TckBusBasic);
      let received = false;

      await bus.subscribe({
        topic: "TckBusBasic",
        callback: async () => {
          received = true;
        },
      });

      await bus.publish(bus.create({ body: "delayed" }), { delay: 500 });

      // Without delayManager, message dispatches immediately
      expect(received).toBe(true);
    });
  });
});
