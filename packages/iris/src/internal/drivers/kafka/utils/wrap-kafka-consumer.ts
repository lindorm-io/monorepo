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
  KafkaEachMessagePayload,
  KafkaSharedState,
  WrapKafkaConsumerOptions,
} from "../types/kafka-types.js";
import { resolveTopicName } from "./resolve-topic-name.js";
import { parseKafkaMessage } from "./parse-kafka-message.js";
import { serializeKafkaMessage } from "./serialize-kafka-message.js";

export type KafkaConsumerCallbackHost<M extends IMessage> = ConsumerCallbackHost<M>;

export type { WrapKafkaConsumerOptions };

export const wrapKafkaConsumer = <M extends IMessage>(
  host: KafkaConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  state: KafkaSharedState,
  metadata: MessageMetadata,
  logger: ILogger,
  options: WrapKafkaConsumerOptions,
): ((payload: KafkaEachMessagePayload) => Promise<void>) => {
  const sendToDeadLetter = async (
    envelope: IrisEnvelope,
    _topic: string,
    err: Error,
  ): Promise<void> => {
    if (options.deadLetterManager) {
      await options.deadLetterManager
        .send(envelope, envelope.topic, err)
        .catch((dlErr) => {
          logger.error("Failed to send to dead letter", { error: dlErr });
        });
    }
  };

  const commitOffset = async (payload: KafkaEachMessagePayload): Promise<void> => {
    const consumer =
      typeof options.consumer === "function" ? options.consumer() : options.consumer;
    await consumer.commitOffsets([
      {
        topic: payload.topic,
        partition: payload.partition,
        offset: String(parseInt(payload.message.offset, 10) + 1),
      },
    ]);
  };

  return async (payload: KafkaEachMessagePayload): Promise<void> => {
    const envelope = parseKafkaMessage(payload);

    const strategies: ConsumeStrategies = {
      onExpired: async () => {},
      onDeserializationError: async (env, err) => {
        if (metadata.deadLetter) {
          await sendToDeadLetter(env, env.topic, err);
        }
      },
      retry: async (retryEnvelope: IrisEnvelope, _topic: string, retryDelay: number) => {
        if (retryDelay > 0 && options.delayManager) {
          await options.delayManager.schedule(retryEnvelope, envelope.topic, retryDelay);
        } else if (state.producer) {
          const topicName = resolveTopicName(state.prefix, envelope.topic);
          const kafkaMessage = serializeKafkaMessage(retryEnvelope);
          await state.producer.send({
            topic: topicName,
            messages: [kafkaMessage],
            acks: state.acks,
          });
        } else {
          throw new Error(
            "No retry mechanism available: both delay manager and producer are unavailable",
          );
        }
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

    // Manage inFlight manually so the offset commit completes BEFORE the
    // counter is decremented. consumeMessageCore's built-in inFlightCounter
    // decrements in its finally block — before we'd get a chance to commit.
    state.inFlightCount++;

    try {
      await consumeMessageCore(envelope, {
        host,
        callback,
        metadata,
        logger,
        strategies,
      });

      // Always commit offset after consumeMessageCore completes.
      // consumeMessageCore handles retry (re-publish) and dead-letter internally,
      // so by this point the message has been fully processed. Not committing would
      // cause KafkaJS to redeliver the same message, creating an infinite loop.
      await commitOffset(payload);
    } finally {
      state.inFlightCount--;
    }
  };
};
