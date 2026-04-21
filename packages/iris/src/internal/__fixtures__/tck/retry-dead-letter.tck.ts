// TCK: Retry & Dead Letter Suite
// Tests retry with backoff and dead-letter queuing.
// Uses REAL timers with small delays (50ms) for cross-driver portability.

import type { ConsumeEnvelope } from "../../../types/consume-envelope";
import type { TckCapabilities, TckDriverHandle } from "./types";
import type { TckMessages } from "./create-tck-messages";
import { waitFor } from "./wait";
import { beforeEach, describe, expect, test } from "vitest";

export const retryDeadLetterSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
) => {
  describe("retry-dead-letter", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("should retry on failure with fixed backoff", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          if (callCount < 3) throw new Error("transient-fail");
        },
      });

      const msg = bus.create({ data: "retry-me" } as any);
      await bus.publish(msg);

      // Wait for initial attempt + retries (50ms fixed backoff * 2 retries + broker buffer)
      await waitFor(() => callCount >= 3, timeoutMs);

      // Should have succeeded on 3rd attempt: no dead letter
      expect(callCount).toBe(3);
      expect(await handle.getDeadLetters("TckRetryMessage")).toHaveLength(0);
    });

    test("should dead-letter after all retries exhausted", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          throw new Error("always-fail");
        },
      });

      const msg = bus.create({ data: "doomed" } as any);
      await bus.publish(msg);

      // Wait for all retries: attempt 0 + 3 retries at 50ms each + broker buffer
      await waitFor(() => callCount >= 4, timeoutMs);

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);

      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const deadLetters = await handle.getDeadLetters("TckRetryMessage");
        expect(deadLetters).toHaveLength(1);
        expect(deadLetters[0].topic).toBe("TckRetryMessage");
        expect(deadLetters[0].error).toBe("always-fail");
      }
    });

    test("should succeed on 2nd try with no dead letter", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          if (callCount === 1) throw new Error("first-fail");
        },
      });

      const msg = bus.create({ data: "recover" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 2, timeoutMs);

      expect(callCount).toBe(2);
      expect(await handle.getDeadLetters("TckRetryMessage")).toHaveLength(0);
    });

    test("should not dead-letter without @DeadLetter decorator", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryNoDlqMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryNoDlqMessage",
        callback: async () => {
          callCount++;
          throw new Error("no-dlq-fail");
        },
      });

      const msg = bus.create({ data: "no-dlq" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 3, timeoutMs);

      // 1 initial + 2 retries = 3 total calls
      expect(callCount).toBe(3);
      expect(await handle.getDeadLetters("TckRetryNoDlqMessage")).toHaveLength(0);
    });

    test("should retry with exponential backoff and succeed on final attempt", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckExponentialRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckExponentialRetryMessage",
        callback: async () => {
          callCount++;
          if (callCount < 3) throw new Error("transient-fail");
        },
      });

      const msg = bus.create({ data: "exp-retry" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 3, timeoutMs);

      expect(callCount).toBe(3);
      expect(await handle.getDeadLetters("TckExponentialRetryMessage")).toHaveLength(0);
    });

    test("should silently drop after exponential retries exhausted (no @DeadLetter)", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckExponentialRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckExponentialRetryMessage",
        callback: async () => {
          callCount++;
          throw new Error("always-fail");
        },
      });

      const msg = bus.create({ data: "exp-doomed" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 3, timeoutMs);

      // 1 initial + 2 retries = 3 total calls
      expect(callCount).toBe(3);
      expect(await handle.getDeadLetters("TckExponentialRetryMessage")).toHaveLength(0);
    });

    test("retry attempt counter increments correctly across retries", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      const attempts: Array<number> = [];

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async (_msg: any, envelope: ConsumeEnvelope) => {
          attempts.push(envelope.attempt);
          if (attempts.length < 4) throw new Error("keep-retrying");
        },
      });

      const msg = bus.create({ data: "attempt-counter" } as any);
      await bus.publish(msg);

      await waitFor(() => attempts.length >= 4, timeoutMs);

      // TckRetryMessage has maxRetries=3, so 4 total deliveries (attempt 0,1,2,3)
      expect(attempts).toHaveLength(4);
      expect(attempts).toEqual([0, 1, 2, 3]);
    });

    (caps?.deadLetter ? test : test.skip)(
      "dead letter entry contains the original topic",
      async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckRetryMessage);
        let callCount = 0;

        await bus.subscribe({
          topic: "TckRetryMessage",
          callback: async () => {
            callCount++;
            throw new Error("topic-check-fail");
          },
        });

        const msg = bus.create({ data: "topic-check" } as any);
        await bus.publish(msg);

        await waitFor(() => callCount >= 4, timeoutMs);

        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
        expect(entries[0].topic).toBe("TckRetryMessage");
      },
    );

    (caps?.deadLetter ? test : test.skip)(
      "dead letter entry contains the error message from the failed callback",
      async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckRetryMessage);
        let callCount = 0;

        await bus.subscribe({
          topic: "TckRetryMessage",
          callback: async () => {
            callCount++;
            throw new Error("specific-failure-reason");
          },
        });

        const msg = bus.create({ data: "error-msg-check" } as any);
        await bus.publish(msg);

        await waitFor(() => callCount >= 4, timeoutMs);

        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
        expect(entries[0].error).toBe("specific-failure-reason");
      },
    );

    test("callback that throws non-Error (string) is still handled correctly", async () => {
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

      const msg = bus.create({ data: "non-error-throw" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 4, timeoutMs);

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);

      // Should still end up in dead letter
      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
      }
    });

    test("callback that returns rejected promise triggers retry", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      let callCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async () => {
          callCount++;
          // Return a rejected promise instead of throwing
          return Promise.reject(new Error("rejected-promise"));
        },
      });

      const msg = bus.create({ data: "rejected" } as any);
      await bus.publish(msg);

      await waitFor(() => callCount >= 4, timeoutMs);

      // 1 initial + 3 retries = 4 total calls
      expect(callCount).toBe(4);

      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
        expect(entries[0].error).toBe("rejected-promise");
      }
    });

    test("multiple messages: one fails and retries, others succeed normally", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);
      const succeeded: Array<string> = [];
      let failCallCount = 0;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async (msg: any) => {
          if (msg.data === "fail-me") {
            failCallCount++;
            throw new Error("selective-fail");
          }
          succeeded.push(msg.data);
        },
      });

      const msgOk1 = bus.create({ data: "ok-1" } as any);
      const msgFail = bus.create({ data: "fail-me" } as any);
      const msgOk2 = bus.create({ data: "ok-2" } as any);

      await bus.publish(msgOk1);
      await bus.publish(msgFail);
      await bus.publish(msgOk2);

      // Wait for retries to exhaust
      await waitFor(() => failCallCount >= 4 && succeeded.length >= 2, timeoutMs);

      // The two successful messages should have been delivered
      expect(succeeded).toContain("ok-1");
      expect(succeeded).toContain("ok-2");

      // The failing message should have retried 1 initial + 3 retries = 4 calls
      expect(failCallCount).toBe(4);

      // Only the failing message should be in the dead letter queue
      if (caps?.deadLetter) {
        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
        expect(entries[0].error).toBe("selective-fail");
      }
    });

    (caps?.deadLetter ? test : test.skip)(
      "dead letter entry preserves error information",
      async () => {
        const handle = getHandle();
        const bus = handle.messageBus(messages.TckRetryMessage);
        let callCount = 0;

        await bus.subscribe({
          topic: "TckRetryMessage",
          callback: async () => {
            callCount++;
            throw new Error("preserved-error");
          },
        });

        const msg = bus.create({ data: "preserve" } as any);
        await bus.publish(msg);

        await waitFor(() => callCount >= 4, timeoutMs);

        await waitFor(
          async () => (await handle.getDeadLetters("TckRetryMessage")).length >= 1,
          timeoutMs,
        );
        const entries = await handle.getDeadLetters("TckRetryMessage");
        expect(entries).toHaveLength(1);
        expect(entries[0].error).toBe("preserved-error");
        expect(typeof entries[0].timestamp).toBe("number");
      },
    );
  });
};
