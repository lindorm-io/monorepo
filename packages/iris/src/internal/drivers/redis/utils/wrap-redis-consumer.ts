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
  RedisSharedState,
  RedisStreamEntry,
  WrapRedisConsumerOptions,
} from "../types/redis-types.js";
import { resolveStreamKey } from "./resolve-stream-key.js";
import { serializeStreamFields } from "./serialize-stream-fields.js";
import { xaddToStream } from "./xadd-to-stream.js";

export type RedisConsumerCallbackHost<M extends IMessage> = ConsumerCallbackHost<M>;

export type { WrapRedisConsumerOptions };

export const wrapRedisConsumer = <M extends IMessage>(
  host: RedisConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  state: RedisSharedState,
  metadata: MessageMetadata,
  logger: ILogger,
  options?: WrapRedisConsumerOptions,
): ((entry: RedisStreamEntry) => Promise<void>) => {
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

  return async (entry: RedisStreamEntry): Promise<void> => {
    const strategies: ConsumeStrategies = {
      onExpired: async () => {},
      onDeserializationError: async (env, err) => {
        if (metadata.deadLetter) {
          await sendToDeadLetter(env, env.topic, err);
        }
      },
      retry: async (retryEnvelope: IrisEnvelope, _topic: string, retryDelay: number) => {
        if (retryDelay > 0 && options?.delayManager) {
          await options.delayManager.schedule(retryEnvelope, entry.topic, retryDelay);
        } else {
          const streamKey = resolveStreamKey(state.prefix, entry.topic);
          const fields = serializeStreamFields(retryEnvelope);

          const conn = state.publishConnection;
          if (conn) {
            await xaddToStream(conn, streamKey, fields, state.maxStreamLength);
            state.publishedStreams.add(streamKey);
          } else {
            throw new Error(
              "No retry mechanism available: both delay manager and publish connection are unavailable",
            );
          }
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

    await consumeMessageCore(entry, {
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
