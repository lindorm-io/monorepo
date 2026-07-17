import type { ILogger } from "@lindorm/logger";
import type {
  KafkaEachMessagePayload,
  KafkaSharedState,
  RetryConsumerAttachment,
} from "../types/kafka-types.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { createKafkaConsumer } from "./create-kafka-consumer.js";
import { deleteKafkaTopicFromState } from "./delete-kafka-topic.js";
import { ensureKafkaTopicFromState } from "./ensure-kafka-topic.js";
import { stopKafkaConsumer } from "./stop-kafka-consumer.js";

type KafkaOnMessage = (payload: KafkaEachMessagePayload) => Promise<void>;

export type EnsureRetryTopicAttachedOptions = {
  state: KafkaSharedState;
  /** The failing subscriber's group id — the retry consumer's group is derived from it. */
  groupId: string;
  /** Fully-resolved per-group retry topic (`<baseKafkaTopic>.retry.<groupId>`). */
  retryTopic: string;
  onMessage: KafkaOnMessage;
  logger: ILogger;
};

// Lazily attach a group's per-group retry-topic consumer on the FIRST retry for
// that group (M1), memoized per retry topic so later retries reuse the
// already-joined consumer and skip straight to publishing.
//
// The retry topic name embeds the group id, so only this one subscriber ever
// publishes to it — a DEDICATED consumer on a fresh group is therefore its sole
// reader, and a redelivery routed there reaches only the failing subscriber,
// never the other fan-out groups on the shared topic. Using a dedicated
// consumer (rather than adding the retry topic to the delivery consumer) is what
// makes the lazy attach safe: it never stops the in-flight delivery consumer, so
// it can be called from inside that consumer's own message handler (which is
// where a retry is detected) without the self-stop deadlock KafkaJS would hit.
//
// Ordering (avoids the 716127bd join-window drop): the attach ensures the topic,
// joins the consumer, and seeks it to the retry topic's log end BEFORE it
// resolves. Callers await this before publishing/scheduling the retry, so the
// just-published retry lands at an offset the newly-joined consumer will read —
// not before its seek position.
export const ensureRetryTopicAttached = async (
  options: EnsureRetryTopicAttachedOptions,
): Promise<void> => {
  const { state, groupId, retryTopic, onMessage, logger } = options;

  const existing = state.retryConsumers.get(retryTopic);
  if (existing) {
    await existing.ready;
    return;
  }

  // The retry consumer runs under its own fresh group (never the delivery
  // group), so joining it triggers no rebalance of the in-flight delivery
  // consumer sharing the delivery group.
  const retryGroupId = `${groupId}.retry`;

  const attach = async (): Promise<void> => {
    if (!state.kafka) {
      throw new IrisDriverError(
        "Cannot attach retry topic: Kafka client is not connected",
        {
          code: "connection_unavailable",
          title: "Connection Unavailable",
          details:
            "The Kafka client is not connected, so the per-group retry topic consumer cannot be attached.",
          data: { driver: "kafka", retryTopic },
        },
      );
    }

    // Create the retry topic up front so it exists before the first retry is
    // produced and before the seek-to-log-end below.
    await ensureKafkaTopicFromState(state, retryTopic, logger);

    const handle = await createKafkaConsumer({
      kafka: state.kafka,
      groupId: retryGroupId,
      topic: retryTopic,
      createdTopics: state.createdTopics,
      onMessage,
      sessionTimeoutMs: state.sessionTimeoutMs,
      logger,
      fromBeginning: false,
      abortSignal: state.abortController.signal,
      prefetch: state.prefetch,
    });

    state.consumers.push(handle);
    attachment.consumerTag = handle.consumerTag;

    // Record the retry-topic subscription so reRegisterKafkaConsumers rebuilds
    // it on reconnect — otherwise retries silently stop being consumed after a
    // broker bounce.
    state.consumerRegistrations.push({
      consumerTag: handle.consumerTag,
      groupId: retryGroupId,
      topic: retryTopic,
      onMessage,
      pooled: false,
      fromBeginning: false,
    });
  };

  // Build the attachment and register it synchronously (no await between the
  // get() above and this set()) so two retries racing on the same group dedupe
  // onto one attach instead of opening two consumers.
  const attachment: RetryConsumerAttachment = {
    groupId: retryGroupId,
    retryTopic,
    consumerTag: undefined,
    ready: undefined as unknown as Promise<void>,
  };
  attachment.ready = attach();
  state.retryConsumers.set(retryTopic, attachment);

  try {
    await attachment.ready;
  } catch (error) {
    // A failed attach leaves nothing usable — drop the memo so a later retry
    // can try again.
    state.retryConsumers.delete(retryTopic);
    throw error;
  }
};

// Tear down a group's lazily-attached retry-topic consumer, if one was ever
// attached (a group that never retried has nothing to clean up). Stops the
// dedicated consumer, drops its registration, and best-effort deletes the
// now-unused retry topic. Deletion is wrapped so a failure never throws out of
// unsubscribe/close (mirrors the RPC reply-topic cleanup).
export const releaseRetryConsumer = async (
  state: KafkaSharedState,
  retryTopic: string,
  logger: ILogger,
): Promise<void> => {
  const attachment = state.retryConsumers.get(retryTopic);
  if (!attachment) return;

  state.retryConsumers.delete(retryTopic);

  try {
    await attachment.ready;
  } catch {
    // Attach failed; there is no consumer to stop, but still delete the topic
    // below in case it was partially created.
  }

  if (attachment.consumerTag) {
    await stopKafkaConsumer(state, attachment.consumerTag);

    const regIdx = state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === attachment.consumerTag,
    );
    if (regIdx !== -1) state.consumerRegistrations.splice(regIdx, 1);
  }

  await deleteKafkaTopicFromState(state, retryTopic, logger);
};
