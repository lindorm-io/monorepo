import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { PublishOptions, SubscribeOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { KafkaConsumer, KafkaSharedState } from "../types/kafka-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase";
import { publishKafkaMessages } from "../utils/publish-kafka-messages";
import { wrapKafkaConsumer } from "../utils/wrap-kafka-consumer";
import { getOrCreatePooledConsumer } from "../utils/create-kafka-consumer";
import { releasePooledConsumer } from "../utils/stop-kafka-consumer";
import { resolveTopicName } from "../utils/resolve-topic-name";
import { resolveGroupId } from "../utils/resolve-group-id";

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
  groupId: string;
  broadcastGroupId: string;
};

export class KafkaMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();

  public constructor(options: KafkaMessageBusOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
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

  public async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot subscribe: Kafka client is not connected");
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
      groupId = `${this.state.prefix}.sub.ephemeral.${randomUUID()}`;
    }

    const getConsumer = (): KafkaConsumer => {
      const p = this.state.consumerPool.get(groupId);
      if (!p)
        throw new IrisDriverError("Pooled consumer not found for group: " + groupId);
      return p.consumer;
    };

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
      },
    );

    // Broadcast consumer: unique group per consumer on a separate broadcast
    // topic so every consumer independently receives every broadcast message.
    const broadcastTopic = `${kafkaTopic}.broadcast`;
    const broadcastGroupId = `${groupId}.bc.${randomUUID()}`;

    const getBroadcastConsumer = (): KafkaConsumer => {
      const p = this.state.consumerPool.get(broadcastGroupId);
      if (!p)
        throw new IrisDriverError(
          "Pooled consumer not found for group: " + broadcastGroupId,
        );
      return p.consumer;
    };

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
      },
    );

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

    this.state.consumerRegistrations.push({
      consumerTag: mainConsumerTag,
      groupId,
      topic: kafkaTopic,
      onMessage: async () => {},
    });

    this.state.consumerRegistrations.push({
      consumerTag: broadcastConsumerTag,
      groupId: broadcastGroupId,
      topic: broadcastTopic,
      onMessage: async () => {},
    });

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, {
      mainConsumerTag,
      broadcastConsumerTag,
      topic: options.topic,
      kafkaTopic,
      broadcastTopic,
      groupId,
      broadcastGroupId,
    });
  }

  public async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    const sub = this.ownedSubscriptions.get(tagKey);

    if (!sub) return;

    await releasePooledConsumer({
      state: this.state,
      groupId: sub.groupId,
      topic: sub.kafkaTopic,
      logger: this.logger,
    });

    await releasePooledConsumer({
      state: this.state,
      groupId: sub.broadcastGroupId,
      topic: sub.broadcastTopic,
      logger: this.logger,
    });

    for (const tag of [sub.mainConsumerTag, sub.broadcastConsumerTag]) {
      const regIdx = this.state.consumerRegistrations.findIndex(
        (r) => r.consumerTag === tag,
      );
      if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
    }

    this.ownedSubscriptions.delete(tagKey);
  }

  public async unsubscribeAll(): Promise<void> {
    for (const [, sub] of this.ownedSubscriptions) {
      await releasePooledConsumer({
        state: this.state,
        groupId: sub.groupId,
        topic: sub.kafkaTopic,
        logger: this.logger,
      });

      await releasePooledConsumer({
        state: this.state,
        groupId: sub.broadcastGroupId,
        topic: sub.broadcastTopic,
        logger: this.logger,
      });

      for (const tag of [sub.mainConsumerTag, sub.broadcastConsumerTag]) {
        const regIdx = this.state.consumerRegistrations.findIndex(
          (r) => r.consumerTag === tag,
        );
        if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
      }
    }

    this.ownedSubscriptions.clear();
  }
}
