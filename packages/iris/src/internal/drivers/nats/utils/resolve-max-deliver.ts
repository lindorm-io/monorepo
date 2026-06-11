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
 */
export const resolveMaxDeliver = (metadata: MessageMetadata): number =>
  metadata.retry ? metadata.retry.maxRetries + 1 : 1;
