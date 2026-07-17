// TCK: Retry Version-Skew Suite (M2)
//
// Proves retry policy is PRODUCER-AUTHORITATIVE: it travels on the wire and is
// honored by the consumer even when the consumer's own @Retry decorator says
// something different. This is the scenario a rolling deploy creates — producer
// on version X, consumer on version Y. Every driver reconstructs retry policy
// from the wire; before M2 RabbitMQ re-derived it from the consumer's local
// @Retry (because it never serialized the retry fields) and diverged.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const retrySkewSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  _caps?: TckCapabilities,
) => {
  describe("retry-skew", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    test("retry policy follows the producer's wire config, not the consumer's local @Retry", async () => {
      const handle = getHandle();
      // Producer declares maxRetries=4; consumer declares maxRetries=1. Both
      // resolve to the same topic ("iris.tck.retry.skew").
      const producer = handle.messageBus(messages.TckSkewProducerMessage);
      const consumer = handle.messageBus(messages.TckSkewConsumerMessage);

      let deliveries = 0;
      await consumer.subscribe({
        topic: "iris.tck.retry.skew",
        callback: async () => {
          deliveries++;
          throw new Error("skew-fail");
        },
      });

      await producer.publish(producer.create({ data: "skew" } as any));

      // Producer maxRetries=4 ⇒ 1 initial + 4 retries = 5 deliveries. If the
      // consumer's local @Retry (maxRetries=1 ⇒ 2 deliveries) leaked in, this
      // never reaches 5 and the wait times out — catching the drift.
      await waitFor(() => deliveries >= 5, timeoutMs);

      // Settle briefly to catch any (wrong) over-delivery beyond the policy.
      await wait(150);

      expect(deliveries).toBe(5);
    });
  });
};
