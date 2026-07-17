import type { ILogger } from "@lindorm/logger";
import type { DeadLetterManager } from "../dead-letter/DeadLetterManager.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";

export type SendToDeadLetter = (
  envelope: IrisEnvelope,
  topic: string,
  err: Error,
) => Promise<void>;

/**
 * Shared dead-letter sender for drivers that swallow-and-log a failed DLQ
 * write (redis / kafka / memory). NATS deliberately does NOT use this: it
 * lets the send throw so its ack/nak strategy can re-nak on failure.
 */
export const createSendToDeadLetter =
  (deadLetterManager: DeadLetterManager | undefined, logger: ILogger): SendToDeadLetter =>
  async (envelope, _topic, err) => {
    if (deadLetterManager) {
      await deadLetterManager.send(envelope, envelope.topic, err).catch((dlErr) => {
        logger.error("Failed to send to dead letter", { error: dlErr });
      });
    }
  };
