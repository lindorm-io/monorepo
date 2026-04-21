// TCK: Encryption Suite
// Verifies @Encrypted roundtrip through the publish/subscribe pipeline.

import type { TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const encryptionSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
) => {
  describe("encryption", () => {
    const { TckEncryptedMessage } = messages;

    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should roundtrip an encrypted message with correct fields", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckEncryptedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckEncryptedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ secretData: "classified-info" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].secretData).toBe("classified-info");
      expect(received[0].id).toBeDefined();
      expect(typeof received[0].id).toBe("string");
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });

    test("should roundtrip multiple encrypted messages in order", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckEncryptedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckEncryptedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const arr = [
        bus.create({ secretData: "secret-one" } as any),
        bus.create({ secretData: "secret-two" } as any),
        bus.create({ secretData: "secret-three" } as any),
      ];

      await bus.publish(arr);

      await waitFor(() => received.length >= 3, timeoutMs);

      expect(received).toHaveLength(3);
      expect(received[0].secretData).toBe("secret-one");
      expect(received[1].secretData).toBe("secret-two");
      expect(received[2].secretData).toBe("secret-three");
    });

    test("should preserve non-encrypted fields alongside encrypted ones", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckEncryptedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckEncryptedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const msg = bus.create({ secretData: "top-secret" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].secretData).toBe("top-secret");
      // Non-encrypted generated fields must survive the encryption roundtrip
      expect(received[0].id).toBeDefined();
      expect(typeof received[0].id).toBe("string");
      expect(received[0].id.length).toBeGreaterThan(0);
      expect(received[0].createdAt).toBeInstanceOf(Date);
    });

    test("should roundtrip a large encrypted payload", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(TckEncryptedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckEncryptedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      const largeSecret = "S".repeat(50_000);
      const msg = bus.create({ secretData: largeSecret } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].secretData).toBe(largeSecret);
      expect(received[0].secretData).toHaveLength(50_000);
    });
  });
};
