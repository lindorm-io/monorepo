import type { MessageMetadata } from "../../../message/types/metadata.js";

/**
 * Resolve the JetStream `max_deliver` value for a consumer from message metadata,
 * aligning server-side redelivery with the Iris retry contract.
 *
 *   - @Retry message:  maxRetries + 1 (initial delivery + maxRetries retries)
 *   - no @Retry:       1 (no server redelivery; Iris/DeadLetter is authoritative)
 *
 * Iris dead-letters / terminates on the final allowed delivery, so this value is a
 * backstop that bounds redelivery if a consumer crashes before ack/nak/term.
 *
 * CONSUMER-AUTHORITATIVE CEILING. Unlike Kafka/Redis/Rabbit — which re-publish an
 * envelope carrying the incremented wire `attempt`, so the producer's `maxRetries`
 * on the wire wins on every retry — NATS redelivers server-side via `msg.nak`,
 * capped by this `max_deliver`. `max_deliver` is a DURABLE CONSUMER property fixed
 * when the consumer is created (subscribe time), from the CONSUMER'S OWN @Retry —
 * before any producer's per-message wire policy is known. It therefore bounds the
 * delivery CEILING to the local @Retry: a producer that puts a HIGHER `maxRetries`
 * on the wire (the rolling-deploy skew case) cannot push an already-subscribed
 * consumer past its own `max_deliver`. This is why NATS sets
 * `retryProducerAuthoritative: false` in the TCK — a genuine JetStream capability
 * difference, not a bug. (Iris's in-app enforcement in `consumeMessageCore` still
 * honors the wire and terms EARLY when the wire budget is lower.)
 */
export const resolveMaxDeliver = (metadata: MessageMetadata): number =>
  metadata.retry ? metadata.retry.maxRetries + 1 : 1;
