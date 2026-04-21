import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces/index.js";
import type {
  ConsumeEnvelope,
  ConsumeOptions,
  PublishOptions,
} from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { KafkaConsumer, KafkaSharedState } from "../types/kafka-types.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { DriverWorkerQueueBase } from "../../../classes/DriverWorkerQueueBase.js";
import { publishKafkaMessages } from "../utils/publish-kafka-messages.js";
import { wrapKafkaConsumer } from "../utils/wrap-kafka-consumer.js";
import { getOrCreatePooledConsumer } from "../utils/create-kafka-consumer.js";
import { releasePooledConsumer } from "../utils/stop-kafka-consumer.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { resolveGroupId } from "../utils/resolve-group-id.js";

export type KafkaWorkerQueueOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: KafkaSharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

type OwnedConsumer = {
  mainConsumerTag: string;
  broadcastConsumerTag: string;
  kafkaTopic: string;
  broadcastTopic: string;
  groupId: string;
  broadcastGroupId: string;
};

export class KafkaWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumers: Map<string, Array<OwnedConsumer>> = new Map();

  public constructor(options: KafkaWorkerQueueOptions<M>) {
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

  public async consume(
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
      throw new IrisDriverError("consume() requires a callback");
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot consume: Kafka client is not connected");
    }

    const kafkaTopic = resolveTopicName(this.state.prefix, queue);
    const groupId = resolveGroupId({
      prefix: this.state.prefix,
      topic: queue,
      queue,
      type: "worker",
      generation: this.state.resetGeneration,
    });

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
      cb,
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
      cb,
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

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push({
      mainConsumerTag,
      broadcastConsumerTag,
      kafkaTopic,
      broadcastTopic,
      groupId,
      broadcastGroupId,
    });
    this.ownedConsumers.set(queue, existing);
  }

  public async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    for (const consumer of consumers) {
      await releasePooledConsumer({
        state: this.state,
        groupId: consumer.groupId,
        topic: consumer.kafkaTopic,
        logger: this.logger,
      });

      await releasePooledConsumer({
        state: this.state,
        groupId: consumer.broadcastGroupId,
        topic: consumer.broadcastTopic,
        logger: this.logger,
      });

      for (const tag of [consumer.mainConsumerTag, consumer.broadcastConsumerTag]) {
        const regIdx = this.state.consumerRegistrations.findIndex(
          (r) => r.consumerTag === tag,
        );
        if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
      }
    }

    this.ownedConsumers.delete(queue);
  }

  public async unconsumeAll(): Promise<void> {
    for (const [, consumers] of this.ownedConsumers) {
      for (const consumer of consumers) {
        await releasePooledConsumer({
          state: this.state,
          groupId: consumer.groupId,
          topic: consumer.kafkaTopic,
          logger: this.logger,
        });

        await releasePooledConsumer({
          state: this.state,
          groupId: consumer.broadcastGroupId,
          topic: consumer.broadcastTopic,
          logger: this.logger,
        });

        for (const tag of [consumer.mainConsumerTag, consumer.broadcastConsumerTag]) {
          const regIdx = this.state.consumerRegistrations.findIndex(
            (r) => r.consumerTag === tag,
          );
          if (regIdx !== -1) this.state.consumerRegistrations.splice(regIdx, 1);
        }
      }
    }

    this.ownedConsumers.clear();
  }
}
