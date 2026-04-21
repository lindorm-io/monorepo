// TCK: Headers Suite
// Verifies @Header fields survive the serialize/deserialize pipeline.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const headersSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("headers", () => {
    const { TckHeaderMessage } = messages;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should roundtrip a message with header fields", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({
        traceId: "trace-abc-123",
        userId: "user-xyz-456",
        body: "hello with headers",
      } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].traceId).toBe("trace-abc-123");
      expect(received[0].userId).toBe("user-xyz-456");
      expect(received[0].body).toBe("hello with headers");
      expect(received[0].id).toBeDefined();
      expect(typeof received[0].id).toBe("string");
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });

    test("should preserve header fields across multiple messages", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const arr = [
        bus.create({
          traceId: "trace-1",
          userId: "user-1",
          body: "first",
        } as any),
        bus.create({
          traceId: "trace-2",
          userId: "user-2",
          body: "second",
        } as any),
      ];

      await bus.publish(arr);

      await waitFor(() => received.length >= 2, timeoutMs);

      expect(received).toHaveLength(2);
      expect(received[0].traceId).toBe("trace-1");
      expect(received[0].userId).toBe("user-1");
      expect(received[0].body).toBe("first");
      expect(received[1].traceId).toBe("trace-2");
      expect(received[1].userId).toBe("user-2");
      expect(received[1].body).toBe("second");
    });

    test("should deliver header fields after unsubscribe and resubscribe", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      await bus.unsubscribe({ topic: "TckHeaderMessage" });

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({
        traceId: "trace-resub",
        userId: "user-resub",
        body: "resubscribed",
      } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].traceId).toBe("trace-resub");
      expect(received[0].userId).toBe("user-resub");
      expect(received[0].body).toBe("resubscribed");
    });

    test("should roundtrip a header with empty string value", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({
        traceId: "",
        userId: "user-non-empty",
        body: "empty-header-test",
      } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].traceId).toBe("");
      expect(received[0].userId).toBe("user-non-empty");
      expect(received[0].body).toBe("empty-header-test");
    });

    test("should roundtrip a header with numeric string value", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({
        traceId: "12345",
        userId: "67890",
        body: "numeric-header-test",
      } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].traceId).toBe("12345");
      expect(received[0].userId).toBe("67890");
      expect(received[0].body).toBe("numeric-header-test");
    });

    test("should preserve all header fields on a single message", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckHeaderMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckHeaderMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({
        traceId: "trace-multi",
        userId: "user-multi",
        body: "all-headers-test",
      } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      // Verify all three fields survive the roundtrip together
      expect(received[0].traceId).toBe("trace-multi");
      expect(received[0].userId).toBe("user-multi");
      expect(received[0].body).toBe("all-headers-test");
      expect(received[0].id).toBeDefined();
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });
  });
};
