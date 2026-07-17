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
import { createSendToDeadLetter } from "../../../utils/create-send-to-dead-letter.js";
import type {
  KafkaEachMessagePayload,
  KafkaSharedState,
  WrapKafkaConsumerOptions,
} from "../types/kafka-types.js";
import { IrisTransportError } from "../../../../errors/IrisTransportError.js";
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
  const sendToDeadLetter = createSendToDeadLetter(options.deadLetterManager, logger);

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
        // Lazily attach this group's per-group retry-topic consumer on the FIRST
        // retry (M1), memoized so later retries reuse it. Awaited BEFORE the
        // retry is scheduled/published, so the retry consumer has joined and
        // seeked to the retry topic's log end before the retry message lands
        // there — for the delayed path too, since the delayed publish only fires
        // after this schedule call. A message type that never fails pays no
        // retry-topic cost at all.
        await options.ensureRetryReady?.();

        // Redeliver to THIS group's per-group retry topic (M1), never the shared
        // topic — otherwise every other fan-out group re-consumes the retry and
        // sees a spurious duplicate. Only this group consumes retryTopic (the
        // dedicated consumer just attached), so the redelivery lands on it alone.
        if (retryDelay > 0 && options.delayManager) {
          await options.delayManager.schedule(
            retryEnvelope,
            envelope.topic,
            retryDelay,
            options.retryTopic,
          );
        } else if (state.producer) {
          const kafkaMessage = serializeKafkaMessage(retryEnvelope);
          await state.producer.send({
            topic: options.retryTopic,
            messages: [kafkaMessage],
            acks: state.acks,
          });
          state.publishedTopics.add(options.retryTopic);
        } else {
          throw new IrisTransportError(
            "No retry mechanism available: both delay manager and producer are unavailable",
            {
              code: "retry_mechanism_unavailable",
              title: "Retry Mechanism Unavailable",
              details:
                "The message cannot be retried because neither the delay manager nor the Kafka producer is available.",
              data: { driver: "kafka" },
            },
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
