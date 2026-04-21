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
  MemoryEnvelope,
  MemorySharedState,
  WrapConsumerCallbackOptions,
} from "../types/memory-store.js";

export type { ConsumerCallbackHost };

export type { WrapConsumerCallbackOptions };

export const wrapConsumerCallback = <M extends IMessage>(
  host: ConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  store: MemorySharedState,
  metadata: MessageMetadata,
  logger: ILogger,
  options?: WrapConsumerCallbackOptions,
): ((envelope: MemoryEnvelope) => Promise<void>) => {
  const sendToDeadLetter = async (
    envelope: IrisEnvelope,
    _topic: string,
    err: Error,
  ): Promise<void> => {
    if (options?.deadLetterManager) {
      await options.deadLetterManager
        .send(envelope, envelope.topic, err)
        .catch((dlErr) => {
          logger.error("Failed to send to dead letter", { error: dlErr });
        });
    }
  };

  const wrappedCallback = async (envelope: MemoryEnvelope): Promise<void> => {
    const strategies: ConsumeStrategies = {
      onExpired: async () => {},
      onDeserializationError: async (env, err) => {
        if (metadata.deadLetter) {
          await sendToDeadLetter(env, env.topic, err);
        }
      },
      retry: async (retryEnvelope, _topic, delay) => {
        const timer = setTimeout(() => {
          store.timers.delete(timer);
          wrappedCallback(retryEnvelope).catch(() => {
            // Error is handled by retry/dead-letter logic
          });
        }, delay);
        timer.unref();
        store.timers.add(timer);
      },
      onRetryFailed: async (env, err) => {
        if (metadata.deadLetter) {
          await sendToDeadLetter(env, env.topic, err);
        }
      },
      deadLetter: sendToDeadLetter,
      onExhaustedNoDeadLetter: async () => {},
      onSuccess: async () => {},
    };

    await consumeMessageCore(envelope, {
      host,
      callback,
      metadata,
      logger,
      strategies,
      inFlightCounter: {
        increment: () => {
          store.inFlightCount++;
        },
        decrement: () => {
          store.inFlightCount--;
        },
      },
    });
  };

  return wrappedCallback;
};
