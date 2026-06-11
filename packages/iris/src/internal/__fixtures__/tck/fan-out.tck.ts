// TCK: Fan-Out Suite
// Tests broadcast and queue-based subscription routing.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const fanOutSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
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

      if (caps?.exactlyOnce) {
        // Exactly-once: each subscriber receives the single message precisely once.
        expect(r1).toHaveLength(1);
        expect(r2).toHaveLength(1);
        expect(r3).toHaveLength(1);
      } else {
        // At-least-once: each subscriber received it (possibly redelivered).
        expect(r1.length).toBeGreaterThanOrEqual(1);
        expect(r2.length).toBeGreaterThanOrEqual(1);
        expect(r3.length).toBeGreaterThanOrEqual(1);
      }
    });

    test("a subscriber mutating its envelope headers does not leak to other subscribers", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);

      let aRan = false;
      let bSawAsMutation: string | undefined = "sentinel";

      // Subscriber A mutates its delivered envelope's headers.
      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (_msg, env) => {
          env.headers["x-iso-leak"] = "mutated-by-A";
          aRan = true;
        },
      });
      // Subscriber B records whether it observes A's mutation. Each delivery must
      // be isolated (real brokers re-parse per delivery); memory dispatches
      // broadcast in subscription order, so A mutates before B reads.
      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (_msg, env) => {
          bSawAsMutation = env.headers["x-iso-leak"];
        },
      });

      await bus.publish(bus.create({ body: "iso" } as any));

      await waitFor(() => aRan && bSawAsMutation !== "sentinel", timeoutMs);

      // B must NOT see A's mutation — envelopes are isolated per delivery.
      expect(bSawAsMutation).toBeUndefined();
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

      const expected = ["rr-0", "rr-1", "rr-2", "rr-3"];
      const all = [...r1, ...r2].map((m) => m.body);

      if (caps?.exactlyOnce) {
        // Exactly-once: the group receives the 4 messages, no duplication.
        expect(r1.length + r2.length).toBe(4);
        expect(all.sort()).toEqual(expected);
      } else {
        // At-least-once: every message delivered to the group at least once.
        const unique = [...new Set(all)].sort();
        expect(unique).toEqual(expected);
      }
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

      const expected = ["multi-q-0", "multi-q-1", "multi-q-2", "multi-q-3"];
      const allA = [...groupA1, ...groupA2].map((m) => m.body);
      const allB = [...groupB1, ...groupB2].map((m) => m.body);

      if (caps?.exactlyOnce) {
        // Exactly-once: each group receives all 4 messages total, no duplication.
        expect(groupA1.length + groupA2.length).toBe(4);
        expect(groupB1.length + groupB2.length).toBe(4);
        expect(allA.sort()).toEqual(expected);
        expect(allB.sort()).toEqual(expected);
      } else {
        // At-least-once: every message delivered to each group at least once.
        expect([...new Set(allA)].sort()).toEqual(expected);
        expect([...new Set(allB)].sort()).toEqual(expected);
      }

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

      await wait(200);

      expect(r1).toHaveLength(0);
      expect(r2).toHaveLength(0);
      expect(r3).toHaveLength(0);
    });
  });
};
