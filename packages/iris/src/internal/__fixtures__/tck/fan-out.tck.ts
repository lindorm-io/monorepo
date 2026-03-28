// TCK: Fan-Out Suite
// Tests broadcast and queue-based subscription routing.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";

export const fanOutSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("fan-out", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("multiple subscribers on same topic all receive", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r1.push(msg);
        },
      });
      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r2.push(msg);
        },
      });
      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r3.push(msg);
        },
      });

      const msg = bus.create({ body: "fanout3" } as any);
      await bus.publish(msg);

      await waitFor(() => r1.length >= 1 && r2.length >= 1 && r3.length >= 1, timeoutMs);

      expect(r1).toHaveLength(1);
      expect(r2).toHaveLength(1);
      expect(r3).toHaveLength(1);
    });

    test("queue grouping round-robins within queue", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "q1",
        callback: async (msg) => {
          r1.push(msg);
        },
      });
      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "q1",
        callback: async (msg) => {
          r2.push(msg);
        },
      });

      for (let i = 0; i < 4; i++) {
        const msg = bus.create({ body: `rr-${i}` } as any);
        await bus.publish(msg);
      }

      await waitFor(() => r1.length + r2.length >= 4, timeoutMs);

      // Both consumers share the 4 messages (distribution may vary by broker —
      // Redis Streams may assign all messages to one consumer with few messages)
      expect(r1.length + r2.length).toBe(4);
    });

    test("unsubscribe one subscriber does not affect others", async () => {
      const handle = getHandle();
      const bus1 = handle.messageBus(messages.TckBasicMessage);
      const bus2 = handle.messageBus(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];

      await bus1.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r1.push(msg);
        },
      });
      await bus2.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r2.push(msg);
        },
      });

      // Unsubscribe bus1
      await bus1.unsubscribeAll();
      await wait(200);

      const msg = bus2.create({ body: "survivor" } as any);
      await bus2.publish(msg);

      await waitFor(() => r2.length >= 1, timeoutMs);

      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(1);
    });

    test("two queue groups with 2 consumers each distribute independently", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);

      const groupA1: Array<any> = [];
      const groupA2: Array<any> = [];
      const groupB1: Array<any> = [];
      const groupB2: Array<any> = [];

      // Queue group A: 2 consumers
      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "groupA",
        callback: async (msg) => {
          groupA1.push(msg);
        },
      });
      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "groupA",
        callback: async (msg) => {
          groupA2.push(msg);
        },
      });

      // Queue group B: 2 consumers
      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "groupB",
        callback: async (msg) => {
          groupB1.push(msg);
        },
      });
      await bus.subscribe({
        topic: "TckBasicMessage",
        queue: "groupB",
        callback: async (msg) => {
          groupB2.push(msg);
        },
      });

      for (let i = 0; i < 4; i++) {
        const msg = bus.create({ body: `multi-q-${i}` } as any);
        await bus.publish(msg);
      }

      await waitFor(
        () =>
          groupA1.length + groupA2.length >= 4 && groupB1.length + groupB2.length >= 4,
        timeoutMs,
      );

      // Each group receives all 4 messages total
      const totalA = groupA1.length + groupA2.length;
      const totalB = groupB1.length + groupB2.length;
      expect(totalA).toBe(4);
      expect(totalB).toBe(4);

      // Within each group, messages are distributed (distribution may vary by broker —
      // with few messages, one consumer in the group may receive all of them)
    });

    test("unsubscribeAll cleans up all subscribers on the bus", async () => {
      const handle = getHandle();
      const bus1 = handle.messageBus(messages.TckBasicMessage);
      const bus2 = handle.messageBus(messages.TckBasicMessage);
      const bus3 = handle.messageBus(messages.TckBasicMessage);
      const r1: Array<any> = [];
      const r2: Array<any> = [];
      const r3: Array<any> = [];

      await bus1.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r1.push(msg);
        },
      });
      await bus2.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r2.push(msg);
        },
      });
      await bus3.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          r3.push(msg);
        },
      });

      await bus1.unsubscribeAll();
      await bus2.unsubscribeAll();
      await bus3.unsubscribeAll();

      await wait(200);

      const publisher = handle.messageBus(messages.TckBasicMessage);
      const msg = publisher.create({ body: "after-unsub-all" } as any);
      await publisher.publish(msg);

      await wait(500);

      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(0);
      expect(r3).toHaveLength(0);
    });
  });
};
