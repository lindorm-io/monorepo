import type { ILogger } from "@lindorm/logger";
import { computeDelay } from "@lindorm/retry";
import type { IMessage } from "../../interfaces";
import type { ConsumeEnvelope } from "../../types";
import type { MessageMetadata } from "../message/types/metadata";
import type { ConsumeStrategies } from "../types/consume-strategies";
import type { IrisEnvelope } from "../types/iris-envelope";
import { isExpired } from "./is-expired";

export type { ConsumeStrategies };

export type ConsumerCallbackHost<M extends IMessage> = {
  prepareForConsume: (
    payload: Buffer | string,
    headers: Record<string, string>,
  ) => Promise<M>;
  afterConsumeSuccess: (message: M) => Promise<void>;
  onConsumeError: (error: Error, message: M) => Promise<void>;
};

export type ConsumeMessageCoreOptions<M extends IMessage> = {
  host: ConsumerCallbackHost<M>;
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>;
  metadata: MessageMetadata;
  logger: ILogger;
  strategies: ConsumeStrategies;
  inFlightCounter?: { increment: () => void; decrement: () => void };
};

export const consumeMessageCore = async <M extends IMessage>(
  envelope: IrisEnvelope,
  options: ConsumeMessageCoreOptions<M>,
): Promise<void> => {
  const { host, callback, metadata, logger, strategies, inFlightCounter } = options;

  if (isExpired(envelope)) {
    logger.debug("Skipping expired message", {
      topic: envelope.topic,
      timestamp: envelope.timestamp,
      expiry: envelope.expiry,
    });
    await strategies.onExpired();
    return;
  }

  inFlightCounter?.increment();

  try {
    let message: M;

    try {
      message = await host.prepareForConsume(envelope.payload, envelope.headers);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      logger.error("Deserialization failed, sending to dead letter", { error: err });
      await strategies.onDeserializationError(envelope, err);
      return;
    }

    const consumeEnvelope: ConsumeEnvelope = {
      topic: envelope.topic,
      messageName: metadata.message.name,
      namespace: metadata.namespace,
      version: metadata.version,
      headers: envelope.headers,
      attempt: envelope.attempt,
      correlationId: envelope.correlationId,
      timestamp: envelope.timestamp,
    };

    try {
      await callback(message, consumeEnvelope);
    } catch (error) {
      const err = error instanceof Error ? error : new Error(String(error));
      await host.onConsumeError(err, message);

      if (envelope.attempt < envelope.maxRetries) {
        const retryDelay = computeDelay(envelope.attempt + 1, {
          strategy: envelope.retryStrategy,
          delay: envelope.retryDelay,
          delayMax: envelope.retryDelayMax,
          multiplier: envelope.retryMultiplier,
          jitter: envelope.retryJitter,
        });

        const retryEnvelope: IrisEnvelope = {
          ...envelope,
          attempt: envelope.attempt + 1,
        };

        try {
          await strategies.retry(retryEnvelope, envelope.topic, retryDelay);
        } catch (retryError) {
          logger.error("Retry publish failed, sending to dead letter", {
            error: retryError,
          });
          await strategies.onRetryFailed(envelope, err);
        }
      } else if (metadata.deadLetter) {
        await strategies.deadLetter(envelope, envelope.topic, err);
      } else {
        await strategies.onExhaustedNoDeadLetter();
      }
      return;
    }

    await strategies.onSuccess();

    try {
      await host.afterConsumeSuccess(message);
    } catch (hookError) {
      logger.error("afterConsumeSuccess hook failed", { error: hookError });
    }
  } finally {
    inFlightCounter?.decrement();
  }
};
