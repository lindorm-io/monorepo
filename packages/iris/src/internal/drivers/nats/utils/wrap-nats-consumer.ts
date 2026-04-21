import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { ConsumeStrategies } from "../../../types/consume-strategies.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import {
  consumeMessageCore,
  type ConsumerCallbackHost,
} from "../../../utils/consume-message-core.js";
import type {
  NatsJsMsg,
  NatsSharedState,
  WrapNatsConsumerOptions,
} from "../types/nats-types.js";
import { parseNatsMessage } from "./parse-nats-message.js";

export type NatsConsumerCallbackHost<M extends IMessage> = ConsumerCallbackHost<M>;

export type { WrapNatsConsumerOptions };

export const wrapNatsConsumer = <M extends IMessage>(
  host: NatsConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  state: NatsSharedState,
  metadata: MessageMetadata,
  logger: ILogger,
  options?: WrapNatsConsumerOptions,
): ((msg: NatsJsMsg) => Promise<void>) => {
  const sendToDeadLetter = async (
    envelope: IrisEnvelope,
    _topic: string,
    err: Error,
  ): Promise<void> => {
    if (options?.deadLetterManager) {
      await options.deadLetterManager.send(envelope, envelope.topic, err);
    }
  };

  // Guarded ack/nak/term — if the connection drops between message receipt and
  // acknowledgment, these calls can throw. Wrapping prevents unhandled errors
  // from masking the real issue. On failure, NATS will redeliver after ack timeout.
  const safeAck = (m: NatsJsMsg): void => {
    try {
      m.ack();
    } catch (e) {
      logger.error("msg.ack() failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
  const safeNak = (m: NatsJsMsg, delay?: number): void => {
    try {
      m.nak(delay);
    } catch (e) {
      logger.error("msg.nak() failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };
  const safeTerm = (m: NatsJsMsg, reason?: string): void => {
    try {
      m.term(reason);
    } catch (e) {
      logger.error("msg.term() failed", {
        error: e instanceof Error ? e.message : String(e),
      });
    }
  };

  return async (msg: NatsJsMsg): Promise<void> => {
    const envelope = parseNatsMessage(msg.data);

    // Use NATS native delivery count for attempt tracking.
    // NATS deliveryCount starts at 1 on first delivery (not 0), so subtract 1
    // to align with Iris's zero-based attempt counter.
    const nativeAttempt = Math.max(0, (msg.info?.deliveryCount ?? 1) - 1);
    envelope.attempt = nativeAttempt;

    // All ack/nak/term strategies use native NATS JetStream mechanisms,
    // following the same pattern as Rabbit (native DLX/TTL, no Iris DelayManager).
    const strategies: ConsumeStrategies = {
      onExpired: async () => {
        safeAck(msg);
      },
      onDeserializationError: async (env, err) => {
        if (metadata.deadLetter) {
          try {
            await sendToDeadLetter(env, env.topic, err);
            safeTerm(msg, "deserialization_error");
          } catch (dlErr) {
            logger.error("Dead letter write failed, nakking for retry", { error: dlErr });
            safeNak(msg, 1000);
          }
        } else {
          logger.error(
            "Deserialization error, discarding message (no dead letter configured)",
            {
              topic: envelope.topic,
            },
          );
          safeAck(msg);
        }
      },
      retry: async (_retryEnvelope: IrisEnvelope, _topic: string, retryDelay: number) => {
        // Native NATS nak with delay — server redelivers after retryDelay ms
        safeNak(msg, retryDelay);
      },
      onRetryFailed: async (env, err) => {
        try {
          if (metadata.deadLetter) {
            await sendToDeadLetter(env, env.topic, err);
          }
          safeTerm(msg, "retry_publish_failed");
        } catch (dlErr) {
          logger.error("Dead letter write failed during retry, nakking for retry", {
            error: dlErr,
          });
          safeNak(msg, 1000);
        }
      },
      deadLetter: async (env, topic, err) => {
        try {
          await sendToDeadLetter(env, topic, err);
          safeTerm(msg, "dead_letter");
        } catch (dlErr) {
          logger.error("Dead letter write failed, nakking for retry", { error: dlErr });
          safeNak(msg, 1000);
        }
      },
      onExhaustedNoDeadLetter: async () => {
        safeTerm(msg, "retries_exhausted");
      },
      onSuccess: async () => {
        safeAck(msg);
      },
    };

    await consumeMessageCore(envelope, {
      host,
      callback,
      metadata,
      logger,
      strategies,
      inFlightCounter: {
        increment: () => {
          state.inFlightCount++;
        },
        decrement: () => {
          state.inFlightCount--;
        },
      },
    });
  };
};
