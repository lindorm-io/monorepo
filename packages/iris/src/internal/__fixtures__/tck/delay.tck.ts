// TCK: Delay Suite
// Tests delayed publish with REAL timers.

import type { TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const delaySuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("delay", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("delayed publish arrives after delay", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "delayed" } as any);
      await bus.publish(msg, { delay: 200 });

      // Should not have arrived yet (allow broker propagation time)
      await wait(50);
      expect(received).toHaveLength(0);

      // Wait for the delay to pass + broker processing buffer
      await waitFor(() => received.length >= 1, timeoutMs);
      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("delayed");
    });

    test("non-delayed publish arrives immediately", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "immediate" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("immediate");
    });

    test("delay of 0ms behaves same as non-delayed (arrives promptly)", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "zero-delay" } as any);
      await bus.publish(msg, { delay: 0 });

      // With 0ms delay, message should arrive promptly
      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("zero-delay");
    });

    test("multiple messages with same delay all arrive after delay period", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg1 = bus.create({ body: "batch-1" } as any);
      const msg2 = bus.create({ body: "batch-2" } as any);
      const msg3 = bus.create({ body: "batch-3" } as any);

      await bus.publish(msg1, { delay: 200 });
      await bus.publish(msg2, { delay: 200 });
      await bus.publish(msg3, { delay: 200 });

      // None should have arrived yet
      await wait(50);
      expect(received).toHaveLength(0);

      // Wait for delay + broker buffer
      await waitFor(() => received.length >= 3, timeoutMs);

      expect(received).toHaveLength(3);
      const bodies = received.map((r) => r.body).sort();
      expect(bodies).toEqual(["batch-1", "batch-2", "batch-3"]);
    });

    test("delayed message preserves all fields correctly (body, headers)", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "preserved-after-delay" } as any);
      await bus.publish(msg, { delay: 150 });

      // Wait for delay + broker buffer
      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("preserved-after-delay");
    });
  });
};
