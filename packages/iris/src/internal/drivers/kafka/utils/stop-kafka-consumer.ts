import type {
  KafkaConsumer,
  KafkaSharedState,
  ReleasePooledConsumerOptions,
} from "../types/kafka-types";
import { createPooledDispatcher } from "./create-kafka-consumer";

const STOP_TIMEOUT_MS = 5_000;

const stopConsumerWithTimeout = async (consumer: KafkaConsumer): Promise<void> => {
  try {
    // Race both stop + disconnect against a single timeout.
    // KafkaJS's disconnect() internally calls runner.stop(), so it also
    // blocks when an eachMessage handler is stuck (e.g. never-resolving RPC).
    let timer: ReturnType<typeof setTimeout>;
    await Promise.race([
      (async () => {
        try {
          await consumer.stop();
        } catch {
          /* already stopped */
        }
        try {
          await consumer.disconnect();
        } catch {
          /* already disconnected */
        }
      })(),
      new Promise<void>((resolve) => {
        timer = setTimeout(resolve, STOP_TIMEOUT_MS);
        timer.unref();
      }),
    ]);
    clearTimeout(timer!);
  } catch {
    // Consumer may already be stopped/disconnected
  }
};

export const stopKafkaConsumer = async (
  state: KafkaSharedState,
  consumerTag: string,
): Promise<void> => {
  const idx = state.consumers.findIndex((c) => c.consumerTag === consumerTag);
  if (idx === -1) return;

  const handle = state.consumers[idx];
  state.consumers.splice(idx, 1);

  await stopConsumerWithTimeout(handle.consumer);
};

export const stopAllKafkaConsumers = async (state: KafkaSharedState): Promise<void> => {
  const consumers = [...state.consumers];
  state.consumers.length = 0;

  await Promise.allSettled(
    consumers.map((handle) => stopConsumerWithTimeout(handle.consumer)),
  );

  state.consumerPool.clear();
};

export type { ReleasePooledConsumerOptions };

export const releasePooledConsumer = async (
  options: ReleasePooledConsumerOptions,
): Promise<void> => {
  const { state, groupId, topic, logger } = options;
  const pooled = state.consumerPool.get(groupId);
  if (!pooled) return;

  const callbacks = pooled.callbacks.get(topic);
  if (callbacks && callbacks.length > 1) {
    callbacks.pop();
  } else {
    pooled.callbacks.delete(topic);
    pooled.topics.delete(topic);
  }
  pooled.refCount--;

  if (pooled.refCount <= 0) {
    state.consumerPool.delete(groupId);

    const idx = state.consumers.findIndex(
      (c) => c.groupId === groupId && c.consumer === pooled.consumer,
    );
    if (idx !== -1) {
      state.consumers.splice(idx, 1);
    }

    // Abort local signal to unblock any stuck handlers before stopping.
    pooled.localAbort.abort();
    await stopConsumerWithTimeout(pooled.consumer);
  } else {
    // Abort + replace local signal to unblock stuck handlers, then restart.
    // Only call consumer.stop() — NOT stopConsumerWithTimeout() which also
    // disconnects. We need the consumer connection alive for re-subscribe.
    pooled.localAbort.abort();
    pooled.localAbort = new AbortController();

    try {
      await pooled.consumer.stop();
    } catch {
      /* already stopped */
    }

    try {
      for (const t of pooled.topics) {
        await pooled.consumer.subscribe({ topic: t, fromBeginning: false });
      }
      await pooled.consumer.run({
        autoCommit: false,
        eachMessage: createPooledDispatcher(
          pooled,
          logger,
          state.abortController.signal,
          pooled.localAbort.signal,
        ),
      });
    } catch (error) {
      logger.error("Failed to restart pooled consumer after topic removal", {
        error: error instanceof Error ? error.message : String(error),
        groupId,
        remainingTopics: [...pooled.topics],
      });
    }
  }
};
