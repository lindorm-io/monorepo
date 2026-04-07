// TCK: Worker Queue Suite
// Tests competing-consumer pattern with round-robin distribution.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";

export const workerQueueSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
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

      expect(received).toHaveLength(3);
      expect(received[0].body).toBe("wq-0");
      expect(received[1].body).toBe("wq-1");
      expect(received[2].body).toBe("wq-2");
    });

    test("3 consumers with 9 messages distribute across all consumers", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        r1.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r2.push(msg);
      });
      await wq.consume("TckBasicMessage", async (msg) => {
        r3.push(msg);
      });

      for (let i = 0; i < 9; i++) {
        const msg = wq.create({ body: `msg-${i}` } as any);
        await wq.publish(msg);
      }

      await waitFor(() => r1.length + r2.length + r3.length >= 9, timeoutMs);

      // All 9 messages distributed across consumers (distribution may vary by broker)
      expect(r1.length + r2.length + r3.length).toBe(9);
      expect(r1.length).toBeGreaterThanOrEqual(1);
      expect(r2.length).toBeGreaterThanOrEqual(1);
      expect(r3.length).toBeGreaterThanOrEqual(1);
    });

    test("unconsume stops receiving messages", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBasicMessage);
      const received: Array<any> = [];

      await wq.consume("TckBasicMessage", async (msg) => {
        received.push(msg);
      });

      const msg1 = wq.create({ body: "before" } as any);
      await wq.publish(msg1);

      await waitFor(() => received.length >= 1, timeoutMs);
      expect(received).toHaveLength(1);

      await wq.unconsume("TckBasicMessage");
      await wait(200);

      const msg2 = wq.create({ body: "after" } as any);
      await wq.publish(msg2);

      await wait(200);
      expect(received).toHaveLength(1);
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

      expect(received).toHaveLength(5);
      for (let i = 0; i < 5; i++) {
        expect(received[i].body).toBe(`order-${i}`);
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

      // All 6 messages are distributed across the two consumers
      const total = r1.length + r2.length;
      expect(total).toBe(6);
      // Each consumer gets at least 1 (distribution may vary by broker)
      expect(r1.length).toBeGreaterThanOrEqual(1);
      expect(r2.length).toBeGreaterThanOrEqual(1);
      // No message is delivered to both consumers
      const allBodies = [...r1, ...r2].map((m) => m.body).sort();
      expect(allBodies).toEqual([
        "multi-0",
        "multi-1",
        "multi-2",
        "multi-3",
        "multi-4",
        "multi-5",
      ]);
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

      const total = r1.length + r2.length + r3.length + r4.length;
      expect(total).toBe(20);
      // Each consumer gets at least 1 (distribution may vary by broker)
      expect(r1.length).toBeGreaterThanOrEqual(1);
      expect(r2.length).toBeGreaterThanOrEqual(1);
      expect(r3.length).toBeGreaterThanOrEqual(1);
      expect(r4.length).toBeGreaterThanOrEqual(1);
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

      expect(received).toHaveLength(3);
      expect(received[0].body).toBe("cross-0");
      expect(received[1].body).toBe("cross-1");
      expect(received[2].body).toBe("cross-2");
    });
  });
};
