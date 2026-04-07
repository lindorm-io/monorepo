import type { ILogger } from "@lindorm/logger";
import { randomUUID } from "@lindorm/random";
import type {
  CreateKafkaConsumerOptions,
  GetOrCreatePooledConsumerOptions,
  KafkaClient,
  KafkaConsumer,
  KafkaConsumerHandle,
  KafkaEachMessagePayload,
  KafkaPooledConsumer,
} from "../types/kafka-types";
import { ensureKafkaTopic } from "./ensure-kafka-topic";

export type { CreateKafkaConsumerOptions, GetOrCreatePooledConsumerOptions };

const DEFAULT_GROUP_JOIN_TIMEOUT_MS = 10_000;

const isUnknownTopicError = (error: unknown): boolean => {
  if (!(error instanceof Error)) return false;
  const msg = error.message ?? "";
  const type = (error as any).type ?? "";
  return (
    type === "UNKNOWN_TOPIC_OR_PARTITION" ||
    msg.includes("UNKNOWN_TOPIC_OR_PARTITION") ||
    msg.includes("does not host this topic-partition") ||
    msg.includes("This server does not host this topic-partition")
  );
};

const subscribeWithAutoCreate = async (
  consumer: KafkaConsumer,
  kafka: KafkaClient,
  topic: string,
  fromBeginning: boolean,
  createdTopics: Set<string>,
  logger: ILogger,
): Promise<void> => {
  try {
    await consumer.subscribe({ topic, fromBeginning });
  } catch (error: unknown) {
    if (!isUnknownTopicError(error)) throw error;

    await ensureKafkaTopic(kafka, topic, createdTopics, logger);
    await consumer.subscribe({ topic, fromBeginning });
  }
};

export const awaitConsumerReady = (
  consumer: KafkaConsumer,
  timeoutMs: number = DEFAULT_GROUP_JOIN_TIMEOUT_MS,
): Promise<void> => {
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      removeListener();
      reject(new Error(`Kafka consumer ready timed out after ${timeoutMs}ms`));
    }, timeoutMs);
    timeout.unref();

    const removeListener = consumer.on(consumer.events.GROUP_JOIN, () => {
      clearTimeout(timeout);
      removeListener();
      resolve();
    });
  });
};

export const createKafkaConsumer = async (
  options: CreateKafkaConsumerOptions,
): Promise<KafkaConsumerHandle> => {
  const {
    kafka,
    groupId,
    topic,
    onMessage,
    sessionTimeoutMs,
    logger,
    fromBeginning = false,
    abortSignal,
  } = options;

  const consumer = kafka.consumer({
    groupId,
    sessionTimeout: sessionTimeoutMs,
  });

  await consumer.connect();
  await subscribeWithAutoCreate(consumer, kafka, topic, fromBeginning, new Set(), logger);

  const readyPromise = awaitConsumerReady(consumer, sessionTimeoutMs);

  await consumer.run({
    autoCommit: false,
    eachMessage: async (payload) => {
      try {
        // Race the handler against the abort signal so stuck handlers
        // (e.g. RPC handlers that never respond) don't prevent shutdown.
        if (abortSignal) {
          let onAbort: (() => void) | undefined;
          const abortPromise = new Promise<never>((_, reject) => {
            if (abortSignal.aborted) {
              reject(new Error("Consumer aborted"));
              return;
            }
            onAbort = (): void => reject(new Error("Consumer aborted"));
            abortSignal.addEventListener("abort", onAbort, { once: true });
          });

          try {
            await Promise.race([onMessage(payload), abortPromise]);
          } finally {
            if (onAbort) {
              abortSignal.removeEventListener("abort", onAbort);
            }
          }
        } else {
          await onMessage(payload);
        }
      } catch (error) {
        if (abortSignal?.aborted) return;

        logger.error("Kafka eachMessage handler failed", {
          error: error instanceof Error ? error.message : String(error),
          topic: payload.topic,
          partition: payload.partition,
          offset: payload.message.offset,
        });
      }
    },
  });

  await readyPromise;

  const consumerTag = randomUUID();

  return {
    consumerTag,
    groupId,
    topic,
    consumer,
  };
};

export const getOrCreatePooledConsumer = async (
  options: GetOrCreatePooledConsumerOptions,
): Promise<{ consumerTag: string }> => {
  const { state, groupId, topic, onMessage, logger, fromBeginning = false } = options;

  if (!state.kafka) {
    throw new Error("Cannot create pooled consumer: Kafka client is not connected");
  }

  const consumerTag = randomUUID();
  const existing = state.consumerPool.get(groupId);

  if (existing) {
    if (existing.topics.has(topic)) {
      const arr = existing.callbacks.get(topic) ?? [];
      arr.push(onMessage);
      existing.callbacks.set(topic, arr);
      existing.refCount++;

      return { consumerTag };
    }

    existing.topics.add(topic);
    existing.callbacks.set(topic, [onMessage]);
    existing.refCount++;

    await existing.consumer.stop();
    for (const t of existing.topics) {
      await subscribeWithAutoCreate(
        existing.consumer,
        state.kafka,
        t,
        fromBeginning,
        state.createdTopics,
        logger,
      );
    }

    const readyPromise = awaitConsumerReady(existing.consumer, state.sessionTimeoutMs);

    await existing.consumer.run({
      autoCommit: false,
      eachMessage: createPooledDispatcher(
        existing,
        logger,
        state.abortController.signal,
        existing.localAbort.signal,
      ),
    });

    await readyPromise;

    return { consumerTag };
  }

  const consumer = state.kafka.consumer({
    groupId,
    sessionTimeout: state.sessionTimeoutMs,
  });

  await consumer.connect();
  await subscribeWithAutoCreate(
    consumer,
    state.kafka,
    topic,
    fromBeginning,
    state.createdTopics,
    logger,
  );

  const localAbort = new AbortController();

  const pooled: KafkaPooledConsumer = {
    consumer,
    groupId,
    topics: new Set([topic]),
    callbacks: new Map([[topic, [onMessage]]]),
    roundRobinCounters: new Map(),
    refCount: 1,
    localAbort,
  };

  const readyPromise = awaitConsumerReady(consumer, state.sessionTimeoutMs);

  await consumer.run({
    autoCommit: false,
    eachMessage: createPooledDispatcher(
      pooled,
      logger,
      state.abortController.signal,
      localAbort.signal,
    ),
  });

  await readyPromise;

  state.consumerPool.set(groupId, pooled);

  state.consumers.push({
    consumerTag,
    groupId,
    topic,
    consumer,
  });

  return { consumerTag };
};

export const createPooledDispatcher = (
  pooled: KafkaPooledConsumer,
  logger: ILogger,
  globalAbortSignal?: AbortSignal,
  localAbortSignal?: AbortSignal,
): ((payload: KafkaEachMessagePayload) => Promise<void>) => {
  return async (payload: KafkaEachMessagePayload): Promise<void> => {
    const callbacks = pooled.callbacks.get(payload.topic);
    if (!callbacks || callbacks.length === 0) {
      logger.warn("Received message for unregistered topic in pooled consumer", {
        topic: payload.topic,
        groupId: pooled.groupId,
      });
      return;
    }

    const index = (pooled.roundRobinCounters.get(payload.topic) ?? 0) % callbacks.length;
    pooled.roundRobinCounters.set(payload.topic, index + 1);
    const callback = callbacks[index];

    const isAborted = () =>
      (globalAbortSignal?.aborted ?? false) || (localAbortSignal?.aborted ?? false);

    try {
      // Race the handler against both abort signals so stuck handlers
      // don't prevent shutdown. Global abort fires on reset(), local
      // abort fires on releasePooledConsumer().
      if (globalAbortSignal || localAbortSignal) {
        let onAbort: (() => void) | undefined;
        const abortPromise = new Promise<never>((_, reject) => {
          if (isAborted()) {
            reject(new Error("Consumer aborted"));
            return;
          }
          onAbort = (): void => reject(new Error("Consumer aborted"));
          globalAbortSignal?.addEventListener("abort", onAbort, { once: true });
          localAbortSignal?.addEventListener("abort", onAbort, { once: true });
        });

        try {
          await Promise.race([callback(payload), abortPromise]);
        } finally {
          if (onAbort) {
            globalAbortSignal?.removeEventListener("abort", onAbort);
            localAbortSignal?.removeEventListener("abort", onAbort);
          }
        }
      } else {
        await callback(payload);
      }
    } catch (error) {
      if (isAborted()) return;

      logger.error("Kafka pooled eachMessage handler failed", {
        error: error instanceof Error ? error.message : String(error),
        topic: payload.topic,
        partition: payload.partition,
        offset: payload.message.offset,
      });
    }
  };
};
