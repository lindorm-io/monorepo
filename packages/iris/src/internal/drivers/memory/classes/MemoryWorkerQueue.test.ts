import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../../interfaces";
import { Broadcast } from "../../../../decorators/Broadcast";
import { DeadLetter } from "../../../../decorators/DeadLetter";
import { Field } from "../../../../decorators/Field";
import { Message } from "../../../../decorators/Message";
import { Retry } from "../../../../decorators/Retry";
import { clearRegistry } from "../../../message/metadata/registry";
import { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import { MemoryDeadLetterStore } from "../../../dead-letter/MemoryDeadLetterStore";
import type { MemorySharedState } from "../types/memory-store";
import { createStore } from "../utils/create-store";
import { MemoryWorkerQueue } from "./MemoryWorkerQueue";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// --- Test message classes ---

@Message({ name: "TckWqBasic" })
class TckWqBasic implements IMessage {
  @Field("string") data!: string;
}

@Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
@DeadLetter()
@Message({ name: "TckWqRetry" })
class TckWqRetry implements IMessage {
  @Field("string") data!: string;
}

@Broadcast()
@Message({ name: "TckWqBroadcast" })
class TckWqBroadcast implements IMessage {
  @Field("string") data!: string;
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

const createWorkerQueue = <M extends IMessage>(
  target: Constructor<M>,
  opts?: { store?: MemorySharedState },
) => {
  const store = opts?.store ?? createStore();
  const logger = createMockLogger();
  const deadLetterManager = new DeadLetterManager({
    store: new MemoryDeadLetterStore(),
    logger: logger as any,
  });
  const wq = new MemoryWorkerQueue<M>({
    target,
    logger: logger as any,
    getSubscribers: () => [],
    store,
    deadLetterManager,
  });
  return { wq, store, deadLetterManager };
};

// --- Tests ---

describe("MemoryWorkerQueue", () => {
  beforeEach(() => {
    clearRegistry();
  });

  describe("publish and consume", () => {
    it("should deliver published message to consumer", async () => {
      const { wq } = createWorkerQueue<TckWqBasic>(TckWqBasic);
      const received: Array<string> = [];

      await wq.consume("TckWqBasic", async (msg) => {
        received.push(msg.data);
      });

      const msg = wq.create({ data: "hello" } as any);
      await wq.publish(msg);

      expect(received).toMatchSnapshot();
    });

    it("should dispatch to both subscribers and consumers", async () => {
      const { wq, store } = createWorkerQueue<TckWqBasic>(TckWqBasic);
      const consumerReceived: Array<string> = [];
      const subscriberReceived: Array<any> = [];

      await wq.consume("TckWqBasic", async (msg) => {
        consumerReceived.push(msg.data);
      });

      store.subscriptions.push({
        topic: "TckWqBasic",
        queue: null,
        callback: async (envelope) => {
          subscriberReceived.push(envelope.topic);
        },
        consumerTag: "test-sub",
      });

      const msg = wq.create({ data: "both" } as any);
      await wq.publish(msg);

      expect(consumerReceived).toHaveLength(1);
      expect(subscriberReceived).toHaveLength(1);
    });
  });

  describe("round-robin with multiple consumers", () => {
    it("should distribute messages in round-robin order", async () => {
      const store = createStore();
      const wq1 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq2 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      const consumerLog: Array<string> = [];

      await wq1.consume("TckWqBasic", async () => {
        consumerLog.push("A");
      });
      await wq2.consume("TckWqBasic", async () => {
        consumerLog.push("B");
      });

      for (let i = 0; i < 4; i++) {
        await wq1.publish(wq1.create({ data: `msg${i}` } as any));
      }

      expect(consumerLog).toEqual(["A", "B", "A", "B"]);
    });

    it("should distribute 6 messages evenly across 3 consumers", async () => {
      const store = createStore();
      const wq1 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq2 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq3 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      const consumerLog: Array<string> = [];

      await wq1.consume("TckWqBasic", async () => {
        consumerLog.push("A");
      });
      await wq2.consume("TckWqBasic", async () => {
        consumerLog.push("B");
      });
      await wq3.consume("TckWqBasic", async () => {
        consumerLog.push("C");
      });

      for (let i = 0; i < 6; i++) {
        await wq1.publish(wq1.create({ data: `msg${i}` } as any));
      }

      expect(consumerLog).toEqual(["A", "B", "C", "A", "B", "C"]);
    });
  });

  describe("broadcast override", () => {
    it("should deliver to ALL consumers when message has @Broadcast", async () => {
      const store = createStore();
      const wq1 = new MemoryWorkerQueue({
        target: TckWqBroadcast,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq2 = new MemoryWorkerQueue({
        target: TckWqBroadcast,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      const consumerLog: Array<string> = [];

      await wq1.consume("TckWqBroadcast", async () => {
        consumerLog.push("A");
      });
      await wq2.consume("TckWqBroadcast", async () => {
        consumerLog.push("B");
      });

      await wq1.publish(wq1.create({ data: "broadcast" } as any));

      expect(consumerLog).toEqual(["A", "B"]);
    });
  });

  describe("retry", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should retry on callback error with fixed backoff", async () => {
      const { wq } = createWorkerQueue(TckWqRetry);
      let callCount = 0;

      await wq.consume("TckWqRetry", async () => {
        callCount++;
        throw new Error("transient failure");
      });

      const msg = wq.create({ data: "retry-me" } as any);
      await wq.publish(msg);

      expect(callCount).toBe(1);

      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(2);

      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(3);
    });

    it("should succeed if callback works on retry", async () => {
      const { wq } = createWorkerQueue<TckWqRetry>(TckWqRetry);
      let callCount = 0;
      const received: Array<string> = [];

      await wq.consume("TckWqRetry", async (msg) => {
        callCount++;
        if (callCount === 1) {
          throw new Error("first attempt fails");
        }
        received.push(msg.data);
      });

      const msg = wq.create({ data: "retry-success" } as any);
      await wq.publish(msg);

      expect(callCount).toBe(1);
      expect(received).toHaveLength(0);

      await vi.advanceTimersByTimeAsync(50);

      expect(callCount).toBe(2);
      expect(received).toMatchSnapshot();
    });

    it("should stop after maxRetries", async () => {
      const { wq } = createWorkerQueue(TckWqRetry);
      let callCount = 0;

      await wq.consume("TckWqRetry", async () => {
        callCount++;
        throw new Error("permanent failure");
      });

      const msg = wq.create({ data: "fail-forever" } as any);
      await wq.publish(msg);

      // attempt 0 (initial)
      expect(callCount).toBe(1);

      // attempt 1
      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(2);

      // attempt 2 (maxRetries=2, so this is the last retry)
      await vi.advanceTimersByTimeAsync(50);
      expect(callCount).toBe(3);

      // no more retries
      await vi.advanceTimersByTimeAsync(500);
      expect(callCount).toBe(3);
    });
  });

  describe("dead letter", () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it("should dead-letter after maxRetries when @DeadLetter enabled", async () => {
      const { wq, deadLetterManager } = createWorkerQueue(TckWqRetry);

      await wq.consume("TckWqRetry", async () => {
        throw new Error("always fails");
      });

      const msg = wq.create({ data: "to-dlq" } as any);
      await wq.publish(msg);

      // Exhaust all retries
      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(50);

      const deadLetters = await deadLetterManager.list();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].topic).toBe("TckWqRetry");
    });

    it("should preserve error in dead letter entry", async () => {
      const { wq, deadLetterManager } = createWorkerQueue(TckWqRetry);

      await wq.consume("TckWqRetry", async () => {
        throw new Error("specific error message");
      });

      const msg = wq.create({ data: "dlq-error" } as any);
      await wq.publish(msg);

      await vi.advanceTimersByTimeAsync(50);
      await vi.advanceTimersByTimeAsync(50);

      const deadLetters = await deadLetterManager.list();
      expect(deadLetters).toHaveLength(1);
      expect(deadLetters[0].error).toBe("specific error message");
    });
  });

  describe("unconsume", () => {
    it("should stop delivery after unconsume", async () => {
      const { wq } = createWorkerQueue<TckWqBasic>(TckWqBasic);
      const received: Array<string> = [];

      await wq.consume("TckWqBasic", async (msg) => {
        received.push(msg.data);
      });

      const msg1 = wq.create({ data: "before" } as any);
      await wq.publish(msg1);

      expect(received).toHaveLength(1);

      await wq.unconsume("TckWqBasic");

      const msg2 = wq.create({ data: "after" } as any);
      await wq.publish(msg2);

      expect(received).toHaveLength(1);
    });

    it("should only remove own consumers", async () => {
      const store = createStore();
      const wq1 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq2 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      const log: Array<string> = [];

      await wq1.consume("TckWqBasic", async () => {
        log.push("wq1");
      });
      await wq2.consume("TckWqBasic", async () => {
        log.push("wq2");
      });

      expect(store.consumers).toHaveLength(2);

      await wq1.unconsume("TckWqBasic");

      expect(store.consumers).toHaveLength(1);

      // Remaining consumer is wq2's
      await wq2.publish(wq2.create({ data: "test" } as any));
      expect(log).toEqual(["wq2"]);
    });
  });

  describe("unconsumeAll", () => {
    it("should remove all owned consumers", async () => {
      const { wq, store } = createWorkerQueue(TckWqBasic);

      await wq.consume("TckWqBasic", async () => {});

      expect(store.consumers).toHaveLength(1);

      await wq.unconsumeAll();

      expect(store.consumers).toHaveLength(0);
    });

    it("should not affect other instances' consumers", async () => {
      const store = createStore();
      const wq1 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });
      const wq2 = new MemoryWorkerQueue({
        target: TckWqBasic,
        logger: createMockLogger() as any,
        getSubscribers: () => [],
        store,
      });

      await wq1.consume("TckWqBasic", async () => {});
      await wq2.consume("TckWqBasic", async () => {});

      expect(store.consumers).toHaveLength(2);

      await wq1.unconsumeAll();

      expect(store.consumers).toHaveLength(1);
    });
  });
});
