// TCK: Retry Fan-Out Suite
// A retry must reach ONLY the consumer that failed — never the consumers that
// already succeeded. This is the regression guard for the M1 blast-radius bug:
// on a fan-out type (N independent bus subscribers, or N broadcast worker
// consumers) a single handler failure previously redelivered to EVERY consumer
// bound to the exchange/topic/stream, so every already-succeeded consumer saw a
// spurious duplicate. The correct contract (memory/nats, and rabbit after the
// queue-targeted fix): the failing consumer sees the redelivery; every other
// consumer sees the message exactly once.
//
// Gated on caps.retryConsumerTargeted (memory/nats/rabbit true; kafka/redis
// false until their targeted-retry slices land).
//
// Uses REAL timers with small delays (50ms @Retry) for cross-driver portability.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

// Grace window (ms) after the expected deliveries land, giving any *spurious*
// duplicate redelivery time to arrive before we assert the exactly-once counts.
const SPURIOUS_GRACE_MS = 400;

export const retryFanoutSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  _caps?: TckCapabilities,
) => {
  describe("retry-fanout", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("non-broadcast fan-out: retry reaches only the failing subscriber", async () => {
      const handle = getHandle();
      const bus = handle.messageBus(messages.TckRetryMessage);

      // Three INDEPENDENT subscribers (no queue) on one non-broadcast type — a
      // message-bus fan-out: each gets its own mailbox and each receives the
      // publish. Subscriber 0 fails on first delivery then succeeds; 1 and 2
      // always succeed.
      const received: Array<Array<string>> = [[], [], []];
      let failingFirstCall = true;

      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async (msg: any) => {
          received[0].push(msg.data);
          if (failingFirstCall) {
            failingFirstCall = false;
            throw new Error("fanout-transient-fail");
          }
        },
      });
      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async (msg: any) => {
          received[1].push(msg.data);
        },
      });
      await bus.subscribe({
        topic: "TckRetryMessage",
        callback: async (msg: any) => {
          received[2].push(msg.data);
        },
      });

      // Let every subscriber's consumer fully initialize before publishing.
      await wait(200);

      await bus.publish(bus.create({ data: "fanout-retry" } as any));

      // The failing subscriber must see it twice (original + 1 redelivery);
      // the other two must each see it at least once.
      await waitFor(
        () =>
          received[0].length >= 2 && received[1].length >= 1 && received[2].length >= 1,
        timeoutMs,
      );

      // Give any spurious duplicate a chance to land before asserting.
      await wait(SPURIOUS_GRACE_MS);

      // Failing subscriber: original delivery + exactly one redelivery.
      expect(received[0]).toEqual(["fanout-retry", "fanout-retry"]);
      // The already-succeeded subscribers must NOT see the retry — exactly once.
      expect(received[1]).toEqual(["fanout-retry"]);
      expect(received[2]).toEqual(["fanout-retry"]);

      // The retry succeeded on redelivery, so nothing is dead-lettered.
      expect(await handle.getDeadLetters("TckRetryMessage")).toHaveLength(0);

      await bus.unsubscribeAll();
    });

    test("broadcast fan-out: retry reaches only the failing consumer", async () => {
      const handle = getHandle();
      const wq = handle.workerQueue(messages.TckBroadcastRetryMessage);

      // Three broadcast worker consumers: every consumer receives the publish.
      // Consumer 0 fails on first delivery then succeeds; 1 and 2 always succeed.
      const received: Array<Array<string>> = [[], [], []];
      let failingFirstCall = true;

      await wq.consume("TckBroadcastRetryMessage", async (msg: any) => {
        received[0].push(msg.data);
        if (failingFirstCall) {
          failingFirstCall = false;
          throw new Error("broadcast-transient-fail");
        }
      });
      await wq.consume("TckBroadcastRetryMessage", async (msg: any) => {
        received[1].push(msg.data);
      });
      await wq.consume("TckBroadcastRetryMessage", async (msg: any) => {
        received[2].push(msg.data);
      });

      // Let every broadcast consumer fully initialize its fetch loop.
      await wait(200);

      await wq.publish(wq.create({ data: "broadcast-retry" } as any));

      await waitFor(
        () =>
          received[0].length >= 2 && received[1].length >= 1 && received[2].length >= 1,
        timeoutMs,
      );

      await wait(SPURIOUS_GRACE_MS);

      // Failing consumer: original broadcast delivery + exactly one redelivery.
      expect(received[0]).toEqual(["broadcast-retry", "broadcast-retry"]);
      // The other broadcast consumers each received it exactly once — the retry
      // did not fan back out to them.
      expect(received[1]).toEqual(["broadcast-retry"]);
      expect(received[2]).toEqual(["broadcast-retry"]);

      await wq.unconsumeAll();
    });
  });
};
