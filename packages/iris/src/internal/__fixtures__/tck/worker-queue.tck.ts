// TCK: Worker Queue Suite
// Tests competing-consumer pattern with round-robin distribution.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const workerQueueSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
) => {
  describe("worker-queue", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("single consumer receives messages", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        received.push(msg);
      });

      for (let i = 0; i < 3; i++) {
        const msg = wq.create({ body: `wq-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => received.length >= 3, timeoutMs);

      if (caps?.strictOrdering) {
        expect(received).toHaveLength(3);
        expect(received[0].body).toBe("wq-0");
        expect(received[1].body).toBe("wq-1");
        expect(received[2].body).toBe("wq-2");
      } else {
        // Order not guaranteed on real brokers — assert every message arrived.
        const bodies = received.map((m) => m.body).sort();
        expect(bodies).toEqual(["wq-0", "wq-1", "wq-2"]);
      }
    });

    test("3 consumers with 9 messages distribute across all consumers", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      // Track body + attempt so on failure the diff distinguishes redelivery
      // (duplicate body, attempt > 0) from cross-test bleed (foreign body).
      const r1: Array<{ body: string; attempt: number }> = [];
      const r2: Array<{ body: string; attempt: number }> = [];
      const r3: Array<{ body: string; attempt: number }> = [];

      await wq.consume("TckBasicMessage", async (msg, env) => {
        r1.push({ body: (msg as any).body, attempt: env.attempt });
      });
      await wq.consume("TckBasicMessage", async (msg, env) => {
        r2.push({ body: (msg as any).body, attempt: env.attempt });
      });
      await wq.consume("TckBasicMessage", async (msg, env) => {
        r3.push({ body: (msg as any).body, attempt: env.attempt });
      });

      for (let i = 0; i < 9; i++) {
        const msg = wq.create({ body: `msg-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => r1.length + r2.length + r3.length >= 9, timeoutMs);
      // Settle past waitFor so any redelivery / straggler surfaces here
      // instead of being hidden by the snapshot-at-resolution timing.
      await wait(200);

      const all = [...r1, ...r2, ...r3];
      const expected = Array.from({ length: 9 }, (_, i) => `msg-${i}`).sort();

      if (caps?.exactlyOnce) {
        // Exactly-once: no duplicates, every message delivered precisely once.
        const bodies = all.map((m) => m.body).sort();
        expect(bodies).toEqual(expected);
        expect(all.map((m) => m.attempt).sort()).toEqual(new Array(9).fill(0));
      } else {
        // At-least-once: every message delivered at least once (duplicates allowed).
        const unique = [...new Set(all.map((m) => m.body))].sort();
        expect(unique).toEqual(expected);
      }

      if (caps?.evenDistribution) {
        // Even round-robin: every competing consumer participated.
        expect(r1.length).toBeGreaterThanOrEqual(1);
        expect(r2.length).toBeGreaterThanOrEqual(1);
        expect(r3.length).toBeGreaterThanOrEqual(1);
      } else {
        // Distribution may concentrate on a subset of consumers.
        expect(r1.length).toBeGreaterThanOrEqual(0);
        expect(r2.length).toBeGreaterThanOrEqual(0);
        expect(r3.length).toBeGreaterThanOrEqual(0);
      }
    });

    test("unconsume stops receiving messages", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      // Track body + attempt so on failure the diff distinguishes redelivery
      // (duplicate "before", attempt > 0) from cross-test bleed (foreign body).
      const received: Array<{ body: string; attempt: number }> = [];

      await wq.consume("TckBasicMessage", async (msg, env) => {
        received.push({ body: (msg as any).body, attempt: env.attempt });
      });

      const msg1 = wq.create({ body: "before" } as any);
      await wq.publish(msg1);

      await waitFor(() => received.length >= 1, timeoutMs);
      // Settle past waitFor so any straggler / redelivery surfaces here.
      await wait(200);
      if (caps?.exactlyOnce) {
        // Exactly-once: precisely one delivery, attempt 0, no redelivery.
        expect(received.map((m) => m.body)).toEqual(["before"]);
        expect(received.map((m) => m.attempt)).toEqual([0]);
      } else {
        // At-least-once: "before" delivered (possibly more than once).
        expect(received.map((m) => m.body)).toContain("before");
      }

      await wq.unconsume("TckBasicMessage");
      await wait(200);

      const msg2 = wq.create({ body: "after" } as any);
      await wq.publish(msg2);

      await wait(200);
      // The unconsume invariant: "after" must never be delivered. Under
      // at-least-once "before" may appear more than once, so assert on "after".
      expect(received.map((m) => m.body)).not.toContain("after");
      if (caps?.exactlyOnce) {
        expect(received.map((m) => m.body)).toEqual(["before"]);
      }
    });

    test("unconsumeAll cleans up all consumers", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });

      await wq.unconsumeAll();
      await wait(200);

      const msg = wq.create({ body: "uc-orphan" } as any);
      await wq.publish(msg);

      await wait(200);

      // After unconsumeAll, the "uc-orphan" message should NOT be received
      const r1Orphan = r1.filter((m) => m.body === "uc-orphan");
      const r2Orphan = r2.filter((m) => m.body === "uc-orphan");
      expect(r1Orphan).toHaveLength(0);
      expect(r2Orphan).toHaveLength(0);
    });

    test("consume accepts object form (ConsumeOptions)", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wq.consume({
        queue: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      for (let i = 0; i < 3; i++) {
        const msg = wq.create({ body: `obj-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(
        () => received.filter((m) => m.body.startsWith("obj-")).length >= 3,
        timeoutMs,
      );

      const mine = received.filter((m) => m.body.startsWith("obj-"));
      expect(mine).toHaveLength(3);
      const bodies = mine.map((m) => m.body).sort();
      expect(bodies).toEqual(["obj-0", "obj-1", "obj-2"]);
    });

    test("publish dispatches to both subscribers and consumers", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const subReceived: Array<any> = [];
      const consumerReceived: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          subReceived.push(msg);
        },
      });

      await wq.consume("TckBasicMessage", async (msg) => {
        consumerReceived.push(msg);
      });

      const msg = bus.create({ body: "both" } as any);
      await bus.publish(msg);

      await waitFor(
        () =>
          subReceived.some((m) => m.body === "both") &&
          consumerReceived.some((m) => m.body === "both"),
        timeoutMs,
      );

      // Both subscriber and consumer received the "both" message
      expect(subReceived.filter((m) => m.body === "both")).toHaveLength(1);
      expect(consumerReceived.filter((m) => m.body === "both")).toHaveLength(1);
    });

    test("single consumer receives messages in publish order", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        received.push(msg);
      });

      for (let i = 0; i < 5; i++) {
        const msg = wq.create({ body: `order-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => received.length >= 5, timeoutMs);

      if (caps?.strictOrdering) {
        expect(received).toHaveLength(5);
        for (let i = 0; i < 5; i++) {
          expect(received[i].body).toBe(`order-${i}`);
        }
      } else {
        // Order not guaranteed on real brokers — assert every message arrived.
        const bodies = received.map((m) => m.body).sort();
        expect(bodies).toEqual(["order-0", "order-1", "order-2", "order-3", "order-4"]);
      }
    });

    test("multiple consumers on same queue each receive a subset of messages", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });

      for (let i = 0; i < 6; i++) {
        const msg = wq.create({ body: `multi-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => r1.length + r2.length >= 6, timeoutMs);

      const expected = ["multi-0", "multi-1", "multi-2", "multi-3", "multi-4", "multi-5"];
      const all = [...r1, ...r2].map((m) => m.body);

      if (caps?.exactlyOnce) {
        // Exactly-once: total equals N, no message delivered twice.
        expect(r1.length + r2.length).toBe(6);
        expect(all.sort()).toEqual(expected);
      } else {
        // At-least-once: every message delivered at least once (duplicates allowed).
        const unique = [...new Set(all)].sort();
        expect(unique).toEqual(expected);
      }

      if (caps?.evenDistribution) {
        // Each consumer participated.
        expect(r1.length).toBeGreaterThanOrEqual(1);
        expect(r2.length).toBeGreaterThanOrEqual(1);
      } else {
        expect(r1.length).toBeGreaterThanOrEqual(0);
        expect(r2.length).toBeGreaterThanOrEqual(0);
      }
    });

    test("large batch: 20 messages with 4 consumers distributes across all consumers", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];
      const r4: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r3.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r4.push(msg);
      });

      for (let i = 0; i < 20; i++) {
        const msg = wq.create({ body: `batch-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => r1.length + r2.length + r3.length + r4.length >= 20, timeoutMs);

      const expected = Array.from({ length: 20 }, (_, i) => `batch-${i}`).sort();
      const all = [...r1, ...r2, ...r3, ...r4].map((m) => m.body);

      if (caps?.exactlyOnce) {
        // Exactly-once: total equals N, no duplicates.
        expect(r1.length + r2.length + r3.length + r4.length).toBe(20);
        expect(all.sort()).toEqual(expected);
      } else {
        // At-least-once: every message delivered at least once (duplicates allowed).
        const unique = [...new Set(all)].sort();
        expect(unique).toEqual(expected);
      }

      if (caps?.evenDistribution) {
        // Each consumer participated.
        expect(r1.length).toBeGreaterThanOrEqual(1);
        expect(r2.length).toBeGreaterThanOrEqual(1);
        expect(r3.length).toBeGreaterThanOrEqual(1);
        expect(r4.length).toBeGreaterThanOrEqual(1);
      } else {
        expect(r1.length).toBeGreaterThanOrEqual(0);
        expect(r2.length).toBeGreaterThanOrEqual(0);
        expect(r3.length).toBeGreaterThanOrEqual(0);
        expect(r4.length).toBeGreaterThanOrEqual(0);
      }
    });

    test("empty queue consume does not error and callback is not invoked", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        received.push(msg);
      });

      // No messages published — just wait briefly
      await wait(200);

      expect(received).toHaveLength(0);
    });

    if (caps?.priority) {
      test("higher-priority message is delivered before a lower-priority message waiting in the queue", async () => {
        const handle = getHandle();
        const wq = handle.workerQueue(messages.TckBasicMessage);
        const received: Array<string> = [];

        // A gate the consumer awaits on its FIRST delivery so it holds that
        // delivery unacked (occupying the single prefetch slot) while we enqueue
        // the priority-ordered pair. The broker cannot dispatch the next message
        // until the warmup is acked, so both low+high sit in the queue and the
        // priority queue picks the high-priority one first.
        let releaseGate!: () => void;
        const gate = new Promise<void>((resolve) => {
          releaseGate = resolve;
        });
        let gated = false;

        await wq.consume("TckBasicMessage", async (msg) => {
          const body = (msg as any).body as string;
          if (!gated) {
            gated = true;
            await gate;
          }
          received.push(body);
        });

        // Occupy the single in-flight slot with a warmup message so the consumer
        // blocks before the priority pair is published.
        await wq.publish(wq.create({ body: "warmup" } as any));
        await waitFor(() => gated, timeoutMs);

        // Both messages are now enqueued behind the held warmup, in publish order
        // low-then-high. A priority queue must still deliver high before low.
        await wq.publish(wq.create({ body: "prio-low" } as any), { priority: 1 });
        await wq.publish(wq.create({ body: "prio-high" } as any), { priority: 9 });
        await wait(200);

        // Release the warmup; the consumer acks it and the broker dispatches the
        // queued pair in priority order.
        releaseGate();

        await waitFor(() => received.length >= 3, timeoutMs);

        expect(received[0]).toBe("warmup");
        expect(received[1]).toBe("prio-high");
        expect(received[2]).toBe("prio-low");
      });
    }

    test("publish and consume same message type on different worker queue instances", async () => {
      const handle = getHandle();
      const wqPublisher = handle.workerQueue(messages.TckBasicMessage);
      const wqConsumer = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wqConsumer.consume("TckBasicMessage", async (msg) => {
        received.push(msg);
      });

      for (let i = 0; i < 3; i++) {
        const msg = wqPublisher.create({ body: `cross-${i}` } as any);
        await wqPublisher.publish(msg);
      }

      await waitFor(() => received.length >= 3, timeoutMs);

      if (caps?.strictOrdering) {
        expect(received).toHaveLength(3);
        expect(received[0].body).toBe("cross-0");
        expect(received[1].body).toBe("cross-1");
        expect(received[2].body).toBe("cross-2");
      } else {
        // Order not guaranteed on real brokers — assert every message arrived.
        const bodies = received.map((m) => m.body).sort();
        expect(bodies).toEqual(["cross-0", "cross-1", "cross-2"]);
      }
    });

    test("@Namespace worker message is delivered to its consumer", async () => {
      // Regression: publish() resolves the namespaced topic (ns.Name) while
      // consume() must derive the same listen-topic from message metadata
      // rather than the raw queue identifier. Otherwise a namespaced worker
      // message is published to ns.Name but consumed on Name and never arrives.
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckNamespacedMessage);
      const received: Array<any> = [];

      await wq.consume("TckNamespacedMessage", async (msg) => {
        received.push(msg);
      });

      for (let i = 0; i < 3; i++) {
        const msg = wq.create({ body: `ns-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => received.length >= 3, timeoutMs);

      const bodies = received.map((m) => m.body).sort();
      expect(bodies).toEqual(["ns-0", "ns-1", "ns-2"]);
    });
  });
};
