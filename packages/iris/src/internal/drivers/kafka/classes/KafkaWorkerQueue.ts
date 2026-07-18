import { lindormId } from "@lindorm/random";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type {
  ConsumeEnvelope,
  ConsumeOptions,
  PublishOptions,
} from "../../../../types/index.js";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseOptions,
} from "../../../classes/DriverWorkerQueueBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { resolveConsumeTopic } from "../../../message/utils/resolve-consume-topic.js";
import type {
  KafkaConsumer,
  KafkaEachMessagePayload,
  KafkaSharedState,
} from "../types/kafka-types.js";
import { getOrCreatePooledConsumer } from "../utils/create-kafka-consumer.js";
import { publishKafkaMessages } from "../utils/publish-kafka-messages.js";
import { resolveGroupId } from "../utils/resolve-group-id.js";
import { resolveRetryTopicName } from "../utils/resolve-retry-topic.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import {
  ensureRetryTopicAttached,
  releaseRetryConsumer,
} from "../utils/retry-topic-consumer.js";
import { releasePooledConsumer } from "../utils/stop-kafka-consumer.js";
import { wrapKafkaConsumer } from "../utils/wrap-kafka-consumer.js";

export type KafkaWorkerQueueOptions<M extends IMessage> =
  DriverWorkerQueueBaseOptions<M> & {
    state: KafkaSharedState;
    delayManager?: DelayManager;
    deadLetterManager?: DeadLetterManager;
  };

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag?: string;
  kafkaTopic: string;
  broadcastTopic?: string;
  mainRetryTopic: string;
  broadcastRetryTopic?: string;
  groupId: string;
  broadcastGroupId?: string;
};

export class KafkaWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumers: Map<string, Array<OwnedConsumer>> = new Map();

  constructor(options: KafkaWorkerQueueOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishKafkaMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
        warnPriorityUnsupportedOnce: (priority) =>
          this.warnPriorityUnsupportedOnce(priority),
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }

  async consume(
    queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
    callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void> {
    if (Array.isArray(queueOrOptions)) {
      for (const opt of queueOrOptions) {
        await this.consume(opt);
      }
      return;
    }

    const queue =
      typeof queueOrOptions === "string" ? queueOrOptions : queueOrOptions.queue;
    const cb = typeof queueOrOptions === "string" ? callback : queueOrOptions.callback;

    if (!cb) {
      throw new IrisDriverError("consume() requires a callback", {
        code: "consume_callback_required",
        title: "Consume Callback Required",
        details:
          "consume() was called without a callback function to handle delivered messages.",
      });
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot consume: Kafka client is not connected", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Kafka client is not connected, so the worker queue cannot start consuming.",
        data: { driver: "kafka" },
      });
    }

    const listenTopic = resolveConsumeTopic(this.metadata, this.logger, queue);
    const kafkaTopic = resolveTopicName(this.state.prefix, listenTopic);
    const groupId = resolveGroupId({
      prefix: this.state.prefix,
      topic: listenTopic,
      queue,
      type: "worker",
      generation: this.state.resetGeneration,
    });

    const getConsumer = (): KafkaConsumer => {
      const p = this.state.consumerPool.get(groupId);
      if (!p)
        throw new IrisDriverError("Pooled consumer not found for group: " + groupId, {
          code: "consumer_not_found",
          title: "Consumer Not Found",
          details:
            "The pooled Kafka consumer for the worker consumer group was not found; it may have been stopped or evicted.",
          data: { driver: "kafka", groupId },
        });
      return p.consumer;
    };

    const mainRetryTopic = resolveRetryTopicName(kafkaTopic, groupId);

    // Lazy retry-topic attach (M1): the ref lets the retry closure reference the
    // very onMessage it is wrapped in — only ever read at retry time.
    const onMessageRef: { current?: (p: KafkaEachMessagePayload) => Promise<void> } = {};
    const onMessage = wrapKafkaConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      cb,
      this.state,
      this.metadata,
      this.logger,
      {
        deadLetterManager: this.deadLetterManager,
        delayManager: this.delayManager,
        consumer: getConsumer,
        retryTopic: mainRetryTopic,
        ensureRetryReady: () =>
          ensureRetryTopicAttached({
            state: this.state,
            groupId,
            retryTopic: mainRetryTopic,
            onMessage: onMessageRef.current!,
            logger: this.logger,
          }),
      },
    );
    onMessageRef.current = onMessage;

    const { consumerTag: mainConsumerTag } = await getOrCreatePooledConsumer({
      state: this.state,
      groupId,
      topic: kafkaTopic,
      onMessage,
      logger: this.logger,
      fromBeginning: false,
    });

    // Record the REAL handler so the driver can rebuild this consumer on
    // reconnect. Storing a no-op here would leave the driver "connected" but
    // silently consuming nothing after a broker bounce (H6/D4).
    this.state.consumerRegistrations.push({
      consumerTag: mainConsumerTag,
      groupId,
      topic: kafkaTopic,
      onMessage,
      pooled: true,
      fromBeginning: false,
    });

    // Broadcast consumer: only for broadcast message types. A unique group per
    // consumer on a separate broadcast topic lets every consumer receive every
    // broadcast message. For non-broadcast types nothing is ever published to the
    // broadcast topic, so the second consumer (and the auto-created `.broadcast`
    // topic it would subscribe into) would be dead overhead.
    let broadcastConsumerTag: string | undefined;
    let broadcastTopic: string | undefined;
    let broadcastRetryTopic: string | undefined;
    let broadcastGroupId: string | undefined;
    if (this.metadata.broadcast) {
      broadcastTopic = `${kafkaTopic}.broadcast`;
      broadcastGroupId = `${groupId}.bc.${lindormId({ length: 16 })}`;
      broadcastRetryTopic = resolveRetryTopicName(broadcastTopic, broadcastGroupId);

      const resolvedBroadcastGroupId = broadcastGroupId;
      const getBroadcastConsumer = (): KafkaConsumer => {
        const p = this.state.consumerPool.get(resolvedBroadcastGroupId);
        if (!p)
          throw new IrisDriverError(
            "Pooled consumer not found for group: " + resolvedBroadcastGroupId,
            {
              code: "consumer_not_found",
              title: "Consumer Not Found",
              details:
                "The pooled Kafka consumer for the worker broadcast consumer group was not found; it may have been stopped or evicted.",
              data: { driver: "kafka", groupId: resolvedBroadcastGroupId },
            },
          );
        return p.consumer;
      };

      const resolvedBroadcastRetryTopic = broadcastRetryTopic;
      const broadcastOnMessageRef: {
        current?: (p: KafkaEachMessagePayload) => Promise<void>;
      } = {};
      const broadcastOnMessage = wrapKafkaConsumer(
        {
          prepareForConsume: (payload, headers) =>
            this.prepareForConsume(payload, headers),
          afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
          onConsumeError: (err, msg) => this.onConsumeError(err, msg),
        },
        cb,
        this.state,
        this.metadata,
        this.logger,
        {
          deadLetterManager: this.deadLetterManager,
          delayManager: this.delayManager,
          consumer: getBroadcastConsumer,
          retryTopic: broadcastRetryTopic,
          ensureRetryReady: () =>
            ensureRetryTopicAttached({
              state: this.state,
              groupId: resolvedBroadcastGroupId,
              retryTopic: resolvedBroadcastRetryTopic,
              onMessage: broadcastOnMessageRef.current!,
              logger: this.logger,
            }),
        },
      );
      broadcastOnMessageRef.current = broadcastOnMessage;

      const result = await getOrCreatePooledConsumer({
        state: this.state,
        groupId: broadcastGroupId,
        topic: broadcastTopic,
        onMessage: broadcastOnMessage,
        logger: this.logger,
        fromBeginning: false,
      });
      broadcastConsumerTag = result.consumerTag;

      this.state.consumerRegistrations.push({
        consumerTag: broadcastConsumerTag,
        groupId: broadcastGroupId,
        topic: broadcastTopic,
        onMessage: broadcastOnMessage,
        pooled: true,
        fromBeginning: false,
      });
    }

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push({
      mainConsumerTag,
      broadcastConsumerTag,
      kafkaTopic,
      broadcastTopic,
      mainRetryTopic,
      broadcastRetryTopic,
      groupId,
      broadcastGroupId,
    });
    this.ownedConsumers.set(queue, existing);
  }

  private async releaseConsumer(consumer: OwnedConsumer): Promise<void> {
    await releasePooledConsumer({
      state: this.state,
      groupId: consumer.groupId,
      topic: consumer.kafkaTopic,
      logger: this.logger,
    });

    // Tear down a lazily-attached retry-topic consumer (M1) only once the worker
    // group is fully released — other live workers competing on the same group
    // still share its retry consumer. A group that never retried has no
    // attachment, so this is a no-op in the common case.
    if (!this.state.consumerPool.has(consumer.groupId)) {
      await releaseRetryConsumer(this.state, consumer.mainRetryTopic, this.logger);
    }

    if (consumer.broadcastGroupId && consumer.broadcastTopic) {
      await releasePooledConsumer({
        state: this.state,
        groupId: consumer.broadcastGroupId,
        topic: consumer.broadcastTopic,
        logger: this.logger,
      });

      if (
        consumer.broadcastRetryTopic &&
        !this.state.consumerPool.has(consumer.broadcastGroupId)
      ) {
        await releaseRetryConsumer(this.state, consumer.broadcastRetryTopic, this.logger);
      }
    }

    const tags = [consumer.mainConsumerTag, consumer.broadcastConsumerTag].filter(
      (t): t is string => Boolean(t),
    );
    for (const tag of tags) {
      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === tag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
    }
  }

  async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    for (const consumer of consumers) {
      await this.releaseConsumer(consumer);
    }

    this.ownedConsumers.delete(queue);
  }

  async unconsumeAll(): Promise<void> {
    for (const [, consumers] of this.ownedConsumers) {
      for (const consumer of consumers) {
        await this.releaseConsumer(consumer);
      }
    }

    this.ownedConsumers.clear();
  }
}
