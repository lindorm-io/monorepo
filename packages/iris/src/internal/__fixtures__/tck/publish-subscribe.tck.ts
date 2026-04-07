// TCK: Publish-Subscribe Suite
// Structural assertions (not snapshots) for cross-driver portability.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";

export const publishSubscribeSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("publish-subscribe", () => {
    const { TckBasicMessage } = messages;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should deliver published message to subscriber", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "hello" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("hello");
    });

    test("should deliver array of messages in order", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const arr = [
        bus.create({ body: "first" } as any),
        bus.create({ body: "second" } as any),
        bus.create({ body: "third" } as any),
      ];

      await bus.publish(arr);

      await waitFor(() => received.length >= 3, timeoutMs);

      expect(received).toHaveLength(3);
      expect(received[0].body).toBe("first");
      expect(received[1].body).toBe("second");
      expect(received[2].body).toBe("third");
    });

    test("should not error when publishing to topic with no subscribers", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const msg = bus.create({ body: "orphan" } as any);

      await expect(bus.publish(msg)).resolves.toBeUndefined();
    });

    test("should stop receiving after unsubscribe", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg1 = bus.create({ body: "before" } as any);
      await bus.publish(msg1);

      await waitFor(() => received.length >= 1, timeoutMs);
      expect(received).toHaveLength(1);

      await bus.unsubscribe({ topic: "TckBasicMessage" });
      await wait(200);

      const msg2 = bus.create({ body: "after" } as any);
      await bus.publish(msg2);

      await wait(200);
      expect(received).toHaveLength(1);
    });

    test("should deliver message published with priority option", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "priority-msg" } as any);
      await bus.publish(msg, { priority: 7 });

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("priority-msg");
    });

    test("should deliver to multiple subscribers (fan-out)", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received1: Array<any> = [];
      const received2: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received1.push(msg);
        },
      });

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received2.push(msg);
        },
      });

      const msg = bus.create({ body: "fanout" } as any);
      await bus.publish(msg);

      await waitFor(() => received1.length >= 1 && received2.length >= 1, timeoutMs);

      expect(received1).toHaveLength(1);
      expect(received2).toHaveLength(1);
      expect(received1[0].body).toBe("fanout");
      expect(received2[0].body).toBe("fanout");
    });

    test("publishing before any subscriber exists does not error", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);

      const msg = bus.create({ body: "no-listener" } as any);
      await expect(bus.publish(msg)).resolves.toBeUndefined();

      // Now subscribe and verify that the earlier message was lost
      const received: Array<any> = [];
      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await wait(200);
      expect(received).toHaveLength(0);
    });

    test("subscribing to topic A does not receive messages published to topic B", async () => {
      const handle = getHandle();
      const busA = handle.messageBus(messages.TckTopicMessage);
      const receivedA: Array<any> = [];

      await busA.subscribe({
        topic: "routed.alpha",
        callback: async (msg) => {
          receivedA.push(msg);
        },
      });

      // Publish to a different resolved topic
      const msgB = busA.create({ category: "beta", body: "wrong-topic" } as any);
      await busA.publish(msgB);

      await wait(200);

      expect(receivedA).toHaveLength(0);

      // Verify the subscriber does receive its own topic
      const msgA = busA.create({ category: "alpha", body: "right-topic" } as any);
      await busA.publish(msgA);

      await waitFor(() => receivedA.length >= 1, timeoutMs);

      expect(receivedA).toHaveLength(1);
      expect(receivedA[0].body).toBe("right-topic");
    });

    test("large message payload roundtrip", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // ~100KB JSON body
      const largeBody = "x".repeat(100_000);
      const msg = bus.create({ body: largeBody } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe(largeBody);
      expect(received[0].body).toHaveLength(100_000);
    });

    test("multiple sequential publish calls deliver all messages", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await bus.publish(bus.create({ body: "seq-0" } as any));
      await bus.publish(bus.create({ body: "seq-1" } as any));
      await bus.publish(bus.create({ body: "seq-2" } as any));
      await bus.publish(bus.create({ body: "seq-3" } as any));
      await bus.publish(bus.create({ body: "seq-4" } as any));

      await waitFor(() => received.length >= 5, timeoutMs);

      expect(received).toHaveLength(5);
      expect(received[0].body).toBe("seq-0");
      expect(received[1].body).toBe("seq-1");
      expect(received[2].body).toBe("seq-2");
      expect(received[3].body).toBe("seq-3");
      expect(received[4].body).toBe("seq-4");
    });

    test("subscriber callback receives message with correct fields", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "field-check" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0]).toHaveProperty("body", "field-check");
      expect(typeof received[0].body).toBe("string");
    });
  });
};
