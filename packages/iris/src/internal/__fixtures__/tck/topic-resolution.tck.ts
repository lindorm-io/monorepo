// TCK: Topic Resolution Suite
// Tests @Topic callback routing and message name fallback.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";

export const topicResolutionSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("topic-resolution", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("@Topic callback is used for routing", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckTopicMessage);
      const received: Array<any> = [];

      // Subscribe to the resolved topic
      await bus.subscribe({
        topic: "routed.events",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ category: "events", body: "topic-test" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].category).toBe("events");
      expect(received[0].body).toBe("topic-test");
    });

    test("subscribing to message name does not receive @Topic-routed messages", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckTopicMessage);
      const received: Array<any> = [];

      // Subscribe to the unresolved message name
      await bus.subscribe({
        topic: "TckTopicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ category: "news", body: "wrong-sub" } as any);
      await bus.publish(msg);

      await wait(500);

      // Should NOT receive: message routes to "routed.news" not "TckTopicMessage"
      expect(received).toHaveLength(0);
    });

    test("@Namespace prefixes the topic", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckNamespacedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "ns.TckNamespacedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "namespaced" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("namespaced");
    });

    test("subscribing without namespace does not receive @Namespace-prefixed messages", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckNamespacedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckNamespacedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "should-not-arrive" } as any);
      await bus.publish(msg);

      await wait(500);

      expect(received).toHaveLength(0);
    });

    test("falls back to message name when no @Topic decorator", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "fallback" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
    });
  });
};
