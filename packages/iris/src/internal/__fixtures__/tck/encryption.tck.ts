// TCK: Encryption Suite
// Verifies @Encrypted roundtrip through the publish/subscribe pipeline.

import type { TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { TCK_INTENDED_KEK, TCK_TRAP_KEK } from "./create-tck-amphora.js";
import { waitFor } from "./wait.js";
import { beforeEach, describe, expect, test, vi } from "vitest";

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

    test("seals with the intended KEK, not the newer enc-capable trap key", async () => {
      // The honesty test. The vault holds two encryption keys that BOTH seal and
      // open a payload: the intended `purpose: "message"` KEK the message names,
      // and a newer `purpose: "audit"` trap. A round-trip alone cannot tell them
      // apart — the wrong KEK decrypts its own ciphertext just fine — so this
      // asserts on the KEK actually selected to seal. If selection ever stops
      // scoping by the message condition, the newer trap wins and this goes RED.
      const handle = getHandle();
      const bus = handle.messageBus(TckEncryptedMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckEncryptedMessage",
        callback: async (msg) => {
          received.push(msg);
        },
      });

      // Spy on the exact vault the pipeline encrypts through. The KEK `find`
      // hands back is the KEK AesKit seals with — its id is the `kid` embedded
      // in the ciphertext. Encryption resolves via `find`; decryption via
      // `findById`, so this observes selection on the write path only.
      const findSpy = vi.spyOn(handle.amphora, "find");

      const msg = bus.create({ secretData: "kek-selection" } as any);
      await bus.publish(msg);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(findSpy).toHaveBeenCalled();
      const sealedWith = await findSpy.mock.results.at(-1)!.value;

      // The intended, purpose-scoped KEK — never the newer, enc-capable trap.
      expect(sealedWith.id).toBe(TCK_INTENDED_KEK.id);
      expect(sealedWith.id).not.toBe(TCK_TRAP_KEK.id);

      // And the plaintext still round-trips.
      expect(received[0].secretData).toBe("kek-selection");

      findSpy.mockRestore();
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
