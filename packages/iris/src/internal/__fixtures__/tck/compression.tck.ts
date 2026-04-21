// TCK: Compression Suite
// Verifies @Compressed roundtrip through the publish/subscribe pipeline.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const compressionSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("compression", () => {
    const { TckCompressedMessage } = messages;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should roundtrip a compressed message with correct fields", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckCompressedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckCompressedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const largePayload = "A".repeat(1024);
      const msg = bus.create({ largePayload } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].largePayload).toBe(largePayload);
      expect(received[0].id).toBeDefined();
      expect(typeof received[0].id).toBe("string");
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });

    test("should roundtrip multiple compressed messages in order", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckCompressedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckCompressedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const arr = [
        bus.create({ largePayload: "first-payload" } as any),
        bus.create({ largePayload: "second-payload" } as any),
      ];

      await bus.publish(arr);

      await waitFor(() => received.length >= 2, timeoutMs);

      expect(received).toHaveLength(2);
      expect(received[0].largePayload).toBe("first-payload");
      expect(received[1].largePayload).toBe("second-payload");
    });

    test("should preserve all fields correctly on compressed message", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckCompressedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckCompressedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ largePayload: "field-check-data" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].largePayload).toBe("field-check-data");
      // Generated fields survive compression roundtrip
      expect(received[0].id).toBeDefined();
      expect(typeof received[0].id).toBe("string");
      expect(received[0].id.length).toBeGreaterThan(0);
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });

    test("should roundtrip a large payload that benefits from compression", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckCompressedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckCompressedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Highly compressible repeated string (~100KB)
      const repeatedPayload = "ABCDEFGHIJ".repeat(10_000);
      const msg = bus.create({ largePayload: repeatedPayload } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].largePayload).toBe(repeatedPayload);
      expect(received[0].largePayload).toHaveLength(100_000);
    });
  });
};
