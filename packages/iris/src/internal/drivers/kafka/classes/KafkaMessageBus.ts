import { randomId } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type {
  KafkaConsumer,
  KafkaEachMessagePayload,
  KafkaSharedState,
} from "../types/kafka-types.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase.js";
import { publishKafkaMessages } from "../utils/publish-kafka-messages.js";
import { wrapKafkaConsumer } from "../utils/wrap-kafka-consumer.js";
import { getOrCreatePooledConsumer } from "../utils/create-kafka-consumer.js";
import { releasePooledConsumer } from "../utils/stop-kafka-consumer.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { resolveGroupId } from "../utils/resolve-group-id.js";
import { resolveRetryTopicName } from "../utils/resolve-retry-topic.js";
import {
  ensureRetryTopicAttached,
  releaseRetryConsumer,
} from "../utils/retry-topic-consumer.js";

export type KafkaMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: KafkaSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedSubscription = {
  mainConsumerTag: string;
  broadcastConsumerTag: string;
  topic: string;
  kafkaTopic: string;
  broadcastTopic: string;
  mainRetryTopic: string;
  broadcastRetryTopic: string;
  groupId: string;
  broadcastGroupId: string;
};

export class KafkaMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();

  constructor(options: KafkaMessageBusOptions<M>) {
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
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }

  async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot subscribe: Kafka client is not connected", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Kafka client is not connected, so the message bus cannot subscribe.",
        data: { driver: "kafka" },
      });
    }

    const kafkaTopic = resolveTopicName(this.state.prefix, options.topic);
    let groupId: string;

    if (options.queue) {
      groupId = resolveGroupId({
        prefix: this.state.prefix,
        topic: options.topic,
        queue: options.queue,
        type: "subscribe",
        generation: this.state.resetGeneration,
      });
    } else {
      groupId = `${this.state.prefix}.sub.ephemeral.${randomId({ length: 16 })}`;
    }

    const getConsumer = (): KafkaConsumer => {
      const p = this.state.consumerPool.get(groupId);
      if (!p)
        throw new IrisDriverError("Pooled consumer not found for group: " + groupId, {
          code: "consumer_not_found",
          title: "Consumer Not Found",
          details:
            "The pooled Kafka consumer for the subscription's consumer group was not found; it may have been stopped or evicted.",
          data: { driver: "kafka", groupId },
        });
      return p.consumer;
    };

    const mainRetryTopic = resolveRetryTopicName(kafkaTopic, groupId);

    // Lazy retry-topic attach (M1): the ref lets the retry closure reference the
    // very onMessage it is wrapped in — only ever read at retry time, by which
    // point it is fully constructed.
    const onMessageRef: { current?: (p: KafkaEachMessagePayload) => Promise<void> } = {};
    const onMessage = wrapKafkaConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      options.callback,
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

    // Broadcast consumer: unique group per consumer on a separate broadcast
    // topic so every consumer independently receives every broadcast message.
    const broadcastTopic = `${kafkaTopic}.broadcast`;
    const broadcastGroupId = `${groupId}.bc.${randomId({ length: 16 })}`;
    const broadcastRetryTopic = resolveRetryTopicName(broadcastTopic, broadcastGroupId);

    const getBroadcastConsumer = (): KafkaConsumer => {
      const p = this.state.consumerPool.get(broadcastGroupId);
      if (!p)
        throw new IrisDriverError(
          "Pooled consumer not found for group: " + broadcastGroupId,
          {
            code: "consumer_not_found",
            title: "Consumer Not Found",
            details:
              "The pooled Kafka consumer for the broadcast consumer group was not found; it may have been stopped or evicted.",
            data: { driver: "kafka", groupId: broadcastGroupId },
          },
        );
      return p.consumer;
    };

    const broadcastOnMessageRef: {
      current?: (p: KafkaEachMessagePayload) => Promise<void>;
    } = {};
    const broadcastOnMessage = wrapKafkaConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      options.callback,
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
            groupId: broadcastGroupId,
            retryTopic: broadcastRetryTopic,
            onMessage: broadcastOnMessageRef.current!,
            logger: this.logger,
          }),
      },
    );
    broadcastOnMessageRef.current = broadcastOnMessage;

    const { consumerTag: mainConsumerTag } = await getOrCreatePooledConsumer({
      state: this.state,
      groupId,
      topic: kafkaTopic,
      onMessage,
      logger: this.logger,
      fromBeginning: false,
    });

    const { consumerTag: broadcastConsumerTag } = await getOrCreatePooledConsumer({
      state: this.state,
      groupId: broadcastGroupId,
      topic: broadcastTopic,
      onMessage: broadcastOnMessage,
      logger: this.logger,
      fromBeginning: false,
    });

    // Record the REAL handlers so the driver can rebuild these consumers on
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

    this.state.consumerRegistrations.push({
      consumerTag: broadcastConsumerTag,
      groupId: broadcastGroupId,
      topic: broadcastTopic,
      onMessage: broadcastOnMessage,
      pooled: true,
      fromBeginning: false,
    });

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, {
      mainConsumerTag,
      broadcastConsumerTag,
      topic: options.topic,
      kafkaTopic,
      broadcastTopic,
      mainRetryTopic,
      broadcastRetryTopic,
      groupId,
      broadcastGroupId,
    });
  }

  private async releaseSubscription(sub: OwnedSubscription): Promise<void> {
    await releasePooledConsumer({
      state: this.state,
      groupId: sub.groupId,
      topic: sub.kafkaTopic,
      logger: this.logger,
    });

    // Tear down a lazily-attached retry-topic consumer (M1) only once its group
    // is fully released from the pool — a queue with other live workers on the
    // same group must keep its shared retry consumer. A group that never retried
    // has no attachment, so this is a no-op for the common case.
    if (!this.state.consumerPool.has(sub.groupId)) {
      await releaseRetryConsumer(this.state, sub.mainRetryTopic, this.logger);
    }

    await releasePooledConsumer({
      state: this.state,
      groupId: sub.broadcastGroupId,
      topic: sub.broadcastTopic,
      logger: this.logger,
    });

    if (!this.state.consumerPool.has(sub.broadcastGroupId)) {
      await releaseRetryConsumer(this.state, sub.broadcastRetryTopic, this.logger);
    }

    for (const tag of [sub.mainConsumerTag, sub.broadcastConsumerTag]) {
      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === tag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
    }
  }

  async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    const sub = this.ownedSubscriptions.get(tagKey);

    if (!sub) return;

    await this.releaseSubscription(sub);
    this.ownedSubscriptions.delete(tagKey);
  }

  async unsubscribeAll(): Promise<void> {
    for (const [, sub] of this.ownedSubscriptions) {
      await this.releaseSubscription(sub);
    }

    this.ownedSubscriptions.clear();
  }
}
