// TCK: Topic Resolution Suite
// Tests @Topic callback routing and message name fallback.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const topicResolutionSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
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

      await wait(200);

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

      await wait(200);

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

    test("a static @Topic publishes on the namespaced topic", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckStaticTopicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "ns.static.topic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "static-topic" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("static-topic");
    });

    // The namespace is applied ONCE. A static topic that re-spelled its own
    // namespace would land on `ns.ns.static.topic` and reach nobody.
    test("a static @Topic is not double-prefixed with its namespace", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckStaticTopicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "ns.ns.static.topic",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "should-not-arrive" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(0);
    });

    test("a static @Topic replaces the message name as the topic", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckStaticTopicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "ns.TckStaticTopicMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "should-not-arrive" } as any);
      await bus.publish(msg);

      await wait(200);

      expect(received).toHaveLength(0);
    });

    // ⭐ THE property the static form exists for. `consume()` gets a queue that
    // is NOT the topic — the queue names the consumer group, the @Topic names
    // the routing key. Only a statically resolvable topic lets the consumer
    // derive the exact string the publisher resolved; a callback returning the
    // same constant would force the queue-string fallback and receive nothing.
    if (caps?.workerQueue) {
      test("a worker queue consuming under an unrelated queue name still receives a static @Topic", async () => {
        const handle = getHandle();
        const wq = handle.workerQueue(messages.TckStaticTopicMessage);
        const received: Array<any> = [];

        await wq.consume("ns.static.topic.persist", async (msg) => {
          received.push(msg);
        });

        const msg = wq.create({ body: "round-trip" } as any);
        await wq.publish(msg);

        await waitFor(() => received.length >= 1, timeoutMs);

        expect(received).toHaveLength(1);
        expect(received[0].body).toBe("round-trip");
      });
    }
  });
};
