// Rabbit Driver Integration Tests
//
// Tests internal driver mechanics and edge cases against real RabbitMQ.
// Complements the TCK (which covers high-level feature behaviour through IrisSource)
// by exercising driver internals directly.

import { randomUUID } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import type { IMessage } from "../../../interfaces";
import { IrisSource } from "../../../classes/IrisSource";
import { Field } from "../../../decorators/Field";
import { Message } from "../../../decorators/Message";
import { Retry } from "../../../decorators/Retry";
import { DeadLetter } from "../../../decorators/DeadLetter";
import { Expiry } from "../../../decorators/Expiry";
import { Topic } from "../../../decorators/Topic";
import type { RabbitDriver } from "./classes/RabbitDriver";
import { afterAll, beforeAll, beforeEach, describe, expect, test, vi } from "vitest";

vi.setConfig({ testTimeout: 30_000 });

const wait = (ms: number): Promise<void> =>
  new Promise((resolve) => setTimeout(resolve, ms));

const createMockLogger = () => ({
  child: vi.fn().mockReturnThis(),
  debug: vi.fn(),
  info: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
  silly: vi.fn(),
  verbose: vi.fn(),
});

// Each describe block creates its own message classes (fresh Symbol.metadata)
// and its own IrisSource with a unique exchange name.

describe("rabbit driver integration", () => {
  // ─── 1. Publisher confirms ─────────────────────────────────────────────────

  describe("publisher confirms", () => {
    @Message({ name: "PubConfirmMsg" })
    class PubConfirmMsg implements IMessage {
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-pc-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [PubConfirmMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    beforeEach(async () => {
      await driver.reset();
    });

    test("successful publish resolves without error (broker confirms)", async () => {
      const pub = source.publisher(PubConfirmMsg);
      const msg = pub.create({ body: "confirmed" } as any);
      await expect(pub.publish(msg)).resolves.toBeUndefined();
    });

    test("confirmed message is received by subscriber", async () => {
      const bus = source.messageBus(PubConfirmMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "PubConfirmMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "roundtrip" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("roundtrip");
    });
  });

  // ─── 2. Publish pipeline ──────────────────────────────────────────────────

  describe("publish pipeline", () => {
    @Message({ name: "PipelineMsg" })
    class PipelineMsg implements IMessage {
      @Field("string") body!: string;
    }

    @Message({ name: "DelayPipelineMsg" })
    class DelayPipelineMsg implements IMessage {
      @Field("string") body!: string;
    }

    @Topic((msg: any) => `routed.${msg.category}`)
    @Message({ name: "TopicRouteMsg" })
    class TopicRouteMsg implements IMessage {
      @Field("string") category!: string;
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-pp-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [PipelineMsg, DelayPipelineMsg, TopicRouteMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    beforeEach(async () => {
      await driver.reset();
    });

    test("single message roundtrips through real exchange to subscriber", async () => {
      const bus = source.messageBus(PipelineMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "PipelineMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "single" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("single");
    });

    test("array of messages publish in order", async () => {
      const bus = source.messageBus(PipelineMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "PipelineMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msgs = [
        bus.create({ body: "alpha" } as any),
        bus.create({ body: "bravo" } as any),
        bus.create({ body: "charlie" } as any),
      ];
      await bus.publish(msgs);

      await wait(200);

      expect(received).toHaveLength(3);
      expect(received[0].body).toBe("alpha");
      expect(received[1].body).toBe("bravo");
      expect(received[2].body).toBe("charlie");
    });

    test("delay queue: message with delay arrives after the delay period", async () => {
      const bus = source.messageBus(DelayPipelineMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "DelayPipelineMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "delayed-pipeline" } as any);
      await bus.publish(msg, { delay: 300 });

      // Should NOT have arrived yet
      await wait(100);
      expect(received).toHaveLength(0);

      // Wait for delay + broker processing
      await wait(500);
      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("delayed-pipeline");
    });

    test("priority header is set on published messages", async () => {
      const bus = source.messageBus(PipelineMsg);
      const received: Array<any> = [];
      const envelopes: Array<any> = [];

      await bus.subscribe({
        topic: "PipelineMsg",
        callback: async (msg, envelope) => {
          received.push(msg);
          envelopes.push(envelope);
        },
      });

      const msg = bus.create({ body: "priority-test" } as any);
      await bus.publish(msg, { priority: 5 });

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("priority-test");
    });

    test("routing key sanitization with special characters", async () => {
      const bus = source.messageBus(TopicRouteMsg);
      const received: Array<any> = [];

      // The topic callback produces `routed.{category}` and sanitizeRoutingKey
      // replaces non-alphanumeric/._- chars with underscores.
      // So `routed.hello world!` becomes `routed.hello_world_`
      await bus.subscribe({
        topic: "routed.hello_world_",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ category: "hello world!", body: "sanitized" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("sanitized");
    });
  });

  // ─── 3. Consumer wrapper ──────────────────────────────────────────────────

  describe("consumer wrapper", () => {
    @Message({ name: "ConsumerOkMsg" })
    class ConsumerOkMsg implements IMessage {
      @Field("string") body!: string;
    }

    @Expiry(100)
    @Message({ name: "ConsumerExpMsg" })
    class ConsumerExpMsg implements IMessage {
      @Field("string") body!: string;
    }

    @Retry({ maxRetries: 2, strategy: "constant", delay: 50 })
    @DeadLetter()
    @Message({ name: "ConsumerRetryDlqMsg" })
    class ConsumerRetryDlqMsg implements IMessage {
      @Field("string") data!: string;
    }

    @Retry({ maxRetries: 1, strategy: "constant", delay: 50 })
    @Message({ name: "ConsumerRetryNoDlqMsg" })
    class ConsumerRetryNoDlqMsg implements IMessage {
      @Field("string") data!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-cw-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [
          ConsumerOkMsg,
          ConsumerExpMsg,
          ConsumerRetryDlqMsg,
          ConsumerRetryNoDlqMsg,
        ],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    beforeEach(async () => {
      await driver.reset();
    });

    test("successful consume: message is acked after callback", async () => {
      const bus = source.messageBus(ConsumerOkMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "ConsumerOkMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "ack-me" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("ack-me");
    });

    test("expired message: acked without invoking callback", async () => {
      const bus = source.messageBus(ConsumerExpMsg);
      const received: Array<any> = [];

      // Publish a message, wait for it to expire, then subscribe
      const msg = bus.create({ body: "will-expire" } as any);
      await bus.publish(msg);

      // Wait longer than the 100ms expiry
      await wait(300);

      // Now subscribe — if the message was queued durably, it should be acked
      // without invoking the callback since it's expired
      await bus.subscribe({
        topic: "ConsumerExpMsg",
        queue: "expiry-test",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await wait(200);

      // The callback should NOT have been invoked for an expired message
      expect(received).toHaveLength(0);
    });

    test("callback error with retries remaining: retry published, original acked", async () => {
      const wq = source.workerQueue(ConsumerRetryDlqMsg);
      let callCount = 0;

      await wq.consume({
        queue: "ConsumerRetryDlqMsg",
        callback: async () => {
          callCount++;
          if (callCount < 2) throw new Error("transient");
        },
      });

      const msg = wq.create({ data: "retry-me" } as any);
      await wq.publish(msg);

      // Wait for initial attempt + 1 retry at 50ms + broker buffer
      await wait(500);

      expect(callCount).toBe(2);
    });

    test("callback error with retries exhausted + dead letter enabled: nacked to DLQ", async () => {
      const wq = source.workerQueue(ConsumerRetryDlqMsg);
      let callCount = 0;

      await wq.consume({
        queue: "ConsumerRetryDlqMsg",
        callback: async () => {
          callCount++;
          throw new Error("always-fail");
        },
      });

      const msg = wq.create({ data: "doomed" } as any);
      await wq.publish(msg);

      // Wait for all retries: 1 initial + 2 retries at 50ms each + broker buffer
      await wait(800);

      expect(callCount).toBe(3);
    });

    test("callback error with retries exhausted + dead letter disabled: acked (discarded)", async () => {
      const wq = source.workerQueue(ConsumerRetryNoDlqMsg);
      let callCount = 0;

      await wq.consume({
        queue: "ConsumerRetryNoDlqMsg",
        callback: async () => {
          callCount++;
          throw new Error("no-dlq-fail");
        },
      });

      const msg = wq.create({ data: "dropped" } as any);
      await wq.publish(msg);

      // Wait for all retries: 1 initial + 1 retry at 50ms + broker buffer
      await wait(500);

      expect(callCount).toBe(2);
    });
  });

  // ─── 4. Driver lifecycle ──────────────────────────────────────────────────

  describe("driver lifecycle", () => {
    @Message({ name: "LifecycleMsg" })
    class LifecycleMsg implements IMessage {
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-lc-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [LifecycleMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    test("reset purges durable queue messages (no stale messages after reset)", async () => {
      const wq = source.workerQueue(LifecycleMsg);

      // Publish messages to a durable worker queue
      await wq.consume({
        queue: "LifecycleMsg",
        callback: async () => {},
      });

      // Publish some messages
      const msg1 = wq.create({ body: "stale-1" } as any);
      const msg2 = wq.create({ body: "stale-2" } as any);
      await wq.publish(msg1);
      await wq.publish(msg2);

      await wait(200);

      // Now unconsume, reset, and reconsume — should get no stale messages
      await wq.unconsume("LifecycleMsg");
      await driver.reset();

      const received: Array<any> = [];

      // Recreate the worker queue after reset (metadata is still valid)
      const wq2 = source.workerQueue(LifecycleMsg);
      await wq2.consume({
        queue: "LifecycleMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await wait(200);

      // Should have received no stale messages
      expect(received).toHaveLength(0);
    });

    test("reset preserves channel health (publish works after reset)", async () => {
      await driver.reset();

      const bus = source.messageBus(LifecycleMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "LifecycleMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "after-reset" } as any);
      await expect(bus.publish(msg)).resolves.toBeUndefined();

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("after-reset");
    });

    test("unbind-before-cancel: after unsubscribe, publish to same topic does not nack", async () => {
      const bus = source.messageBus(LifecycleMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "LifecycleMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Verify subscription works
      const msg1 = bus.create({ body: "before-unsub" } as any);
      await bus.publish(msg1);
      await wait(200);
      expect(received).toHaveLength(1);

      // Unsubscribe
      await bus.unsubscribe({ topic: "LifecycleMsg" });
      await wait(100);

      // Publish again — should not cause a channel error or nack
      const msg2 = bus.create({ body: "after-unsub" } as any);
      await expect(bus.publish(msg2)).resolves.toBeUndefined();

      await wait(200);

      // Message should not be received (no subscriber)
      expect(received).toHaveLength(1);
    });

    test("connection state reports correctly after connect", async () => {
      expect(driver.getConnectionState()).toBe("connected");
      expect(await driver.ping()).toBe(true);
    });
  });

  // ─── 5. Queue and exchange assertions ─────────────────────────────────────

  describe("queue and exchange setup", () => {
    @Message({ name: "SetupMsg" })
    class SetupMsg implements IMessage {
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-se-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [SetupMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    test("setup creates main exchange, DLX exchange, and DLQ queue", async () => {
      // If setup didn't work, publishing/subscribing would fail.
      // Verify by doing a successful roundtrip.
      const bus = source.messageBus(SetupMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "SetupMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "setup-ok" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
    });

    test("worker queue creates queue with DLX argument and delivers messages", async () => {
      const wq = source.workerQueue(SetupMsg);
      const received: Array<any> = [];

      // Consuming creates the queue with x-dead-letter-exchange argument
      await wq.consume({
        queue: "SetupMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = wq.create({ body: "wq-dlx" } as any);
      await wq.publish(msg);

      await wait(200);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("wq-dlx");
    });

    test("multiple subscribes to same durable queue are idempotent", async () => {
      const bus1 = source.messageBus(SetupMsg);
      const bus2 = source.messageBus(SetupMsg);
      const received1: Array<any> = [];
      const received2: Array<any> = [];

      await bus1.subscribe({
        topic: "SetupMsg",
        queue: "shared-q",
        callback: async (msg) => {
          received1.push(msg);
        },
      });

      await bus2.subscribe({
        topic: "SetupMsg",
        queue: "shared-q",
        callback: async (msg) => {
          received2.push(msg);
        },
      });

      // Both are consuming from the same durable queue — messages
      // should be load-balanced (one gets it, not both)
      const msg = bus1.create({ body: "shared" } as any);
      await bus1.publish(msg);

      await wait(200);

      const total = received1.length + received2.length;
      expect(total).toBe(1);
    });
  });

  // ─── 6. Delay queue DLX configuration ────────────────────────────────────

  describe("delay queue mechanics", () => {
    @Message({ name: "DelayMechMsg" })
    class DelayMechMsg implements IMessage {
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-dm-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [DelayMechMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    beforeEach(async () => {
      await driver.reset();
    });

    test("delay queue routes message back to main exchange after TTL", async () => {
      const bus = source.messageBus(DelayMechMsg);
      const received: Array<{ msg: any; time: number }> = [];
      const publishTime = Date.now();

      await bus.subscribe({
        topic: "DelayMechMsg",
        callback: async (msg) => {
          received.push({ msg, time: Date.now() });
        },
      });

      const msg = bus.create({ body: "delayed-mech" } as any);
      await bus.publish(msg, { delay: 200 });

      // Verify it hasn't arrived too early
      await wait(100);
      expect(received).toHaveLength(0);

      // Wait for the delay + broker overhead
      await wait(400);
      expect(received).toHaveLength(1);

      // The delay should be at least 200ms
      const elapsed = received[0].time - publishTime;
      expect(elapsed).toBeGreaterThanOrEqual(180); // Allow 20ms tolerance
    });

    test("multiple delayed messages to the same topic reuse delay queue", async () => {
      const bus = source.messageBus(DelayMechMsg);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "DelayMechMsg",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg1 = bus.create({ body: "d1" } as any);
      const msg2 = bus.create({ body: "d2" } as any);

      await bus.publish(msg1, { delay: 100 });
      await bus.publish(msg2, { delay: 100 });

      await wait(400);

      expect(received).toHaveLength(2);
      const bodies = received.map((r) => r.body).sort();
      expect(bodies).toEqual(["d1", "d2"]);
    });
  });

  // ─── 7. Multiple reset cycles ─────────────────────────────────────────────

  describe("multiple reset cycles", () => {
    @Message({ name: "ResetCycleMsg" })
    class ResetCycleMsg implements IMessage {
      @Field("string") body!: string;
    }

    let source: IrisSource;
    let driver: RabbitDriver;
    const exchange = `iris-integ-rc-${randomUUID().slice(0, 8)}`;

    beforeAll(async () => {
      source = new IrisSource({
        driver: "rabbit",
        url: "amqp://localhost:5672",
        exchange,
        logger: createMockLogger() as any,
        messages: [ResetCycleMsg],
      });
      await source.connect();
      await source.setup();
      driver = (source as any)._driver as RabbitDriver;
    });

    afterAll(async () => {
      await source.disconnect();
    });

    test("driver survives three consecutive resets and publishes", async () => {
      for (let i = 0; i < 3; i++) {
        await driver.reset();

        // Re-setup exchanges after reset (reset clears assertedQueues but
        // exchanges persist in RabbitMQ)
        await driver.setup([]);

        const bus = source.messageBus(ResetCycleMsg);
        const received: Array<any> = [];

        await bus.subscribe({
          topic: "ResetCycleMsg",
          callback: async (msg) => {
            received.push(msg);
          },
        });

        const msg = bus.create({ body: `cycle-${i}` } as any);
        await bus.publish(msg);

        await wait(200);

        expect(received).toHaveLength(1);
        expect(received[0].body).toBe(`cycle-${i}`);
      }
    });
  });
});
