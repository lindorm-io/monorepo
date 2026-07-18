// TCK: Retry Version-Skew Suite (M2)
//
// Proves retry policy is PRODUCER-AUTHORITATIVE: it travels on the wire and is
// honored by the consumer even when the consumer's own @Retry decorator says
// something different. This is the scenario a rolling deploy creates — producer
// on version X, consumer on version Y. Wire-reconstructing drivers (memory,
// Kafka/Redis/Rabbit re-publish an envelope carrying the incremented wire
// `attempt`) honor the producer count; before M2 RabbitMQ re-derived it from the
// consumer's local @Retry (because it never serialized the retry fields) and
// diverged.
//
// This suite is HONEST both ways — no driver's behaviour is left unverified:
//   • retryProducerAuthoritative:true (memory/kafka/redis/rabbit) → the
//     producer-authoritative test asserts the wire count wins (5 deliveries).
//   • retryProducerAuthoritative:false (NATS) → the inverse test asserts the
//     consumer-authoritative ceiling: redelivery is server-driven (nak) and
//     bounded by the durable consumer's `max_deliver`, fixed at subscribe time
//     from the LOCAL @Retry before any producer wire policy is known, so a higher
//     producer `maxRetries` cannot raise the ceiling on an already-subscribed
//     consumer. See TckCapabilities.retryProducerAuthoritative and resolveMaxDeliver.

import type { TckCapabilities, TckDriverHandle } from "./types.js";
import type { TckMessages } from "./create-tck-messages.js";
import { wait, waitFor } from "./wait.js";
import { beforeEach, describe, expect, test } from "vitest";

export const retrySkewSuite = (
  getHandle: () => TckDriverHandle,
  messages: TckMessages,
  timeoutMs: number,
  caps?: TckCapabilities,
) => {
  describe("retry-skew", () => {
    beforeEach(async () => {
      await getHandle().clear();
    });

    (caps?.retryProducerAuthoritative ? test : test.skip)(
      "retry policy follows the producer's wire config, not the consumer's local @Retry",
      async () => {
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
      },
    );

    // Inverse (honest negative) for retryProducerAuthoritative:false — NATS. The
    // producer-authoritative test above SKIPS on NATS; without this, NATS's
    // documented consumer-authoritative ceiling would go entirely unverified.
    // Same skew pair, same subscribe path: the durable consumer's max_deliver is
    // fixed at subscribe time from the CONSUMER's local @Retry (maxRetries=1 ⇒ a
    // ceiling of 1 initial + 1 retry = 2 deliveries). The producer's HIGHER wire
    // maxRetries=4 (which yields 5 deliveries on the producer-authoritative
    // drivers) must NOT raise that server ceiling. See resolveMaxDeliver.
    (caps?.retryProducerAuthoritative === false ? test : test.skip)(
      "consumer-authoritative ceiling: a higher producer wire maxRetries cannot exceed the consumer's local max_deliver",
      async () => {
        const handle = getHandle();
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

        // Consumer ceiling = 1 initial + 1 retry = 2 deliveries.
        await waitFor(() => deliveries >= 2, timeoutMs);

        // Settle well past the producer's would-be budget: had the wire
        // maxRetries=4 (5 deliveries) leaked past the consumer ceiling, the extra
        // deliveries (50ms backoff + server nak AckWait each) would land here.
        await wait(600);

        // The server ceiling wins: exactly the consumer's 2 deliveries, never the
        // producer's 5. Proves NATS is consumer-authoritative for the ceiling and
        // the producer's higher wire budget did NOT leak in.
        expect(deliveries).toBe(2);
        expect(deliveries).toBeLessThan(5);
      },
    );
  });
};
