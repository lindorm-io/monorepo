// TCK: Expiry Suite
// Tests message expiry with REAL timers.

import type { TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const expirySuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("expiry", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("message consumed within expiry window is delivered", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "within-window" } as any);
      await bus.publish(msg);

      // TckExpiryMessage has @Expiry(200) — immediate publish should arrive
      await waitFor(() => received.length >= 1, timeoutMs);
      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("within-window");
    });

    test("message that expires before consumption is not delivered", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Delay exceeds @Expiry(200) — message should expire before delivery
      const msg = bus.create({ body: "expired" } as any);
      await bus.publish(msg, { delay: 300 });

      await wait(50);
      expect(received).toHaveLength(0);

      // Wait past the delay + broker buffer — message should still not arrive (expired)
      await wait(600);
      expect(received).toHaveLength(0);
    });

    test("publish-time expiry override replaces decorator value", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // @Expiry(200) on the class, but override to 50ms at publish time.
      // Delay of 200ms exceeds the 50ms override — message expires.
      const msg = bus.create({ body: "overridden" } as any);
      await bus.publish(msg, { delay: 200, expiry: 50 });

      await wait(50);
      expect(received).toHaveLength(0);

      // Wait past the delay + broker buffer — message should still not arrive (expired)
      await wait(500);
      expect(received).toHaveLength(0);
    });

    test("zero expiry (0ms) with delay — message expires before delivery", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Override expiry to 0ms + add a small delay — message should expire before delivery
      const msg = bus.create({ body: "zero-expiry" } as any);
      await bus.publish(msg, { delay: 50, expiry: 0 });

      // Wait generous amount — message should never arrive (expired before delivery)
      await wait(300);
      expect(received).toHaveLength(0);
    });

    test("expired message does not trigger subscriber callback", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      let callbackInvoked = false;
      let errorOccurred = false;

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async () => {
          callbackInvoked = true;
          throw new Error("should-not-be-called");
        },
      });

      // Delay exceeds expiry — message should expire without delivery
      const msg = bus.create({ body: "no-hooks" } as any);
      await bus.publish(msg, { delay: 300, expiry: 50 });

      // Wait past the delay + broker buffer
      await wait(600);

      // Neither the callback nor any error processing should have fired
      expect(callbackInvoked).toBe(false);
      expect(errorOccurred).toBe(false);
    });

    test("multiple messages: expired ones skipped, non-expired ones delivered", async () => {
      const handle = getHandle();
      const { TckExpiryMessage } = messages;

      const bus = handle.messageBus(TckExpiryMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckExpiryMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Message 1: immediate publish, should arrive within 200ms expiry window
      const msg1 = bus.create({ body: "alive" } as any);
      await bus.publish(msg1);

      // Message 2: delayed past expiry window — should expire
      const msg2 = bus.create({ body: "expired" } as any);
      await bus.publish(msg2, { delay: 300 });

      // Message 3: immediate publish, should also arrive
      const msg3 = bus.create({ body: "also-alive" } as any);
      await bus.publish(msg3);

      // Wait for immediate messages to arrive
      await waitFor(() => received.length >= 2, timeoutMs);
      expect(received).toHaveLength(2);

      // Wait past the delay + broker buffer for the expired message
      await wait(500);

      // Still only 2 messages — the delayed one expired
      expect(received).toHaveLength(2);
      const bodies = received.map((r) => r.body).sort();
      expect(bodies).toEqual(["alive", "also-alive"]);
    });
  });
};
