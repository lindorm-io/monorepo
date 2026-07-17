import type { ILogger } from "@lindorm/logger";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope } from "../../../../types/index.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import type { ConsumeStrategies } from "../../../types/consume-strategies.js";
import {
  consumeMessageCore,
  type ConsumerCallbackHost,
} from "../../../utils/consume-message-core.js";
import { createSendToDeadLetter } from "../../../utils/create-send-to-dead-letter.js";
import type {
  RedisConsumeOutcome,
  RedisSharedState,
  RedisStreamEntry,
  WrapRedisConsumerOptions,
} from "../types/redis-types.js";

export type RedisConsumerCallbackHost<M extends IMessage> = ConsumerCallbackHost<M>;

export type { WrapRedisConsumerOptions };

/**
 * Attempt-counting model (Redis, M1 Option B): trust the stream consumer-group
 * DELIVERY COUNT, mirroring the NATS driver's use of the server `deliveryCount`.
 *
 * On handler failure within the retry budget the entry is NOT re-published to
 * the shared stream (which every fan-out group would re-read — the M1
 * blast-radius bug). Instead the wrapper returns `"retain"` so the consumer
 * loop leaves the entry in the FAILING group's PEL (pending list). Only that
 * group redelivers it — via the loop's delayed XCLAIM reclaim — so a retry
 * reaches ONLY the consumer that failed, matching nats/memory. The reclaim
 * increments the delivery count and threads it back in as `entry.attempt`, so
 * the serialized wire `attempt` is vestigial on this driver (as on nats).
 *
 * The retry backoff (`computeDelay`) is honored by the loop's reclaim
 * min-idle-time, so the `retry` strategy here does no scheduling — leaving the
 * entry pending IS the retry.
 */
export const wrapRedisConsumer = <M extends IMessage>(
  host: RedisConsumerCallbackHost<M>,
  callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  state: RedisSharedState,
  metadata: MessageMetadata,
  logger: ILogger,
  options?: WrapRedisConsumerOptions,
): ((entry: RedisStreamEntry) => Promise<RedisConsumeOutcome>) => {
  const sendToDeadLetter = createSendToDeadLetter(options?.deadLetterManager, logger);

  return async (entry: RedisStreamEntry): Promise<RedisConsumeOutcome> => {
    // Default to ack; only the retry path flips this to retain (PEL-retain).
    let outcome: RedisConsumeOutcome = "ack";

    const strategies: ConsumeStrategies = {
      // Expired / poison / exhausted all ACK: the entry is done, drop it from
      // the PEL so it is never redelivered.
      onExpired: async () => {},
      onDeserializationError: async (env, err) => {
        if (metadata.deadLetter) {
          await sendToDeadLetter(env, env.topic, err);
        }
      },
      // Within the retry budget: retain the entry in the failing group's PEL.
      // No re-publish, no delay scheduling — the loop's reclaim redelivers this
      // exact entry to this exact group after the backoff (min-idle-time).
      retry: async () => {
        outcome = "retain";
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

    return outcome;
  };
};
