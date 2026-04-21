// TCK: Error Resilience Suite
// Verifies the pipeline handles consumer errors gracefully without crashing.

import type { TckCapabilities, TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { wait, waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const errorResilienceSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
) => {
  describe("error-resilience", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("callback that throws a string does not crash the pipeline", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          // eslint-disable-next-line no-throw-literal
          throw "string-error";
        },
      });

      const msg = bus.create({ data: "string-throw" } as any);
      await bus.publish(msg);

      // Wait for all retries: 1 initial + 3 retries at 50ms each + broker buffer
      await waitFor(() => callCount >= 4, timeoutMs + 2000);

      // Pipeline did not crash — the callback was invoked for initial + retries
      expect(callCount).toBe(4);

      // Dead-lettered with the string coerced to an Error
      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const deadLetters = await handle.getDeadLetters("TckRetryMessage");
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].error).toBe("string-error");
      }
    });

    test("callback that throws null does not crash the pipeline", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          // eslint-disable-next-line no-throw-literal
          throw null;
        },
      });

      const msg = bus.create({ data: "null-throw" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 4, timeoutMs + 2000);

      expect(callCount).toBe(4);

      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const deadLetters = await handle.getDeadLetters("TckRetryMessage");
        expect(deadLetters).toHaveLength(1);
        expect(typeof deadLetters[0].error).toBe("string");
      }
    });

    test("callback that throws undefined does not crash the pipeline", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          // eslint-disable-next-line no-throw-literal
          throw undefined;
        },
      });

      const msg = bus.create({ data: "undefined-throw" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 4, timeoutMs + 2000);

      expect(callCount).toBe(4);

      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const deadLetters = await handle.getDeadLetters("TckRetryMessage");
        expect(deadLetters).toHaveLength(1);
        expect(typeof deadLetters[0].error).toBe("string");
      }
    });

    test("callback that returns a rejected promise is treated same as throw", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          return Promise.reject(new Error("rejected-promise"));
        },
      });

      const msg = bus.create({ data: "reject-promise" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 4, timeoutMs + 2000);

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);

      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const deadLetters = await handle.getDeadLetters("TckRetryMessage");
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].error).toBe("rejected-promise");
      }
    });

    test("publishing after a consumer error still delivers subsequent messages", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];
      let shouldFail = true;

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          if (shouldFail) {
            shouldFail = false;
            throw new Error("first-message-fails");
          }
          received.push(msg);
        },
      });

      // First message will fail
      const msg1 = bus.create({ body: "will-fail" } as any);
      await bus.publish(msg1);

      await wait(200);

      // Second message should still be delivered
      const msg2 = bus.create({ body: "should-succeed" } as any);
      await bus.publish(msg2);

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("should-succeed");
    });

    test("multiple sequential errors do not break the consumer pipeline", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];
      let errorCount = 0;

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          if (errorCount < 3) {
            errorCount++;
            throw new Error(`sequential-error-${errorCount}`);
          }
          received.push(msg);
        },
      });

      // Publish 4 messages — first 3 will error, 4th should succeed
      for (let i = 0; i < 4; i++) {
        const msg = bus.create({ body: `msg-${i}` } as any);
        await bus.publish(msg);
        await wait(100);
      }

      await waitFor(() => received.length >= 1, timeoutMs);

      expect(errorCount).toBe(3);
      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("msg-3");
    });

    test("slow callback (200ms) still completes and message is acked", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckBasicMessage);
      const received: Array<any> = [];

      await bus.subscribe({
        topic: "TckBasicMessage",
        callback: async (msg) => {
          await wait(200);
          received.push(msg);
        },
      });

      const msg = bus.create({ body: "slow-callback" } as any);
      await bus.publish(msg);

      // Wait long enough for the slow callback to complete
      await waitFor(() => received.length >= 1, timeoutMs);

      expect(received).toHaveLength(1);
      expect(received[0].body).toBe("slow-callback");
    });
  });
};
