import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope, PublishOptions } from "../../../../types/index.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseOptions,
} from "../../../classes/DriverWorkerQueueBase.js";
import { resolveConsumeTopic } from "../../../message/utils/resolve-consume-topic.js";
import { publishRabbitMessages } from "../utils/publish-messages.js";
import { wrapRabbitConsumer } from "../utils/wrap-rabbit-consumer.js";
import { resolveQueueName } from "../utils/resolve-queue-name.js";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key.js";
import { RABBIT_MAX_PRIORITY } from "../utils/rabbit-constants.js";

export type RabbitWorkerQueueOptions<M extends IMessage> =
  DriverWorkerQueueBaseOptions<M> & {
    state: RabbitSharedState;
  };

type OwnedConsumer = {
  consumerTag: string;
  queueName: string;
  routingKey: string;
};

export class RabbitWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<
  M,
  OwnedConsumer
> {
  private readonly state: RabbitSharedState;

  constructor(options: RabbitWorkerQueueOptions<M>) {
    super(options);
    this.state = options.state;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRabbitMessages(
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
    );
  }

  protected async consumeOne(
    queue: string,
    cb: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<OwnedConsumer> {
    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError("Cannot consume: consume channel is not available", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The RabbitMQ consume channel is not available, so the worker queue cannot start consuming.",
        data: { driver: "rabbit" },
      });
    }

    let queueName: string;
    const listenTopic = resolveConsumeTopic(this.metadata, this.logger, queue);
    const routingKey = sanitizeRoutingKey(listenTopic);

    if (this.metadata.broadcast) {
      const result = await channel.assertQueue("", {
        exclusive: true,
        autoDelete: true,
      });
      queueName = result.queue;
      await channel.bindQueue(queueName, this.state.exchange, routingKey);
    } else {
      queueName = resolveQueueName({
        exchange: this.state.exchange,
        topic: queue,
        queue,
        type: "worker",
      });

      if (!this.state.assertedQueues.has(queueName)) {
        await channel.assertQueue(queueName, {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": this.state.dlxExchange,
            "x-max-priority": RABBIT_MAX_PRIORITY,
          },
        });
        await channel.bindQueue(queueName, this.state.exchange, routingKey);
        this.state.assertedQueues.add(queueName);
      }
    }

    const wrappedCallback = wrapRabbitConsumer(
      this.consumerHooks(),
      cb,
      this.state,
      this.metadata,
      this.logger,
      queueName,
    );

    const { consumerTag } = await channel.consume(queueName, wrappedCallback);

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage: wrappedCallback,
      routingKey,
      exchange: this.state.exchange,
      queueOptions: this.metadata.broadcast
        ? { exclusive: true, autoDelete: true }
        : {
            durable: true,
            arguments: {
              "x-dead-letter-exchange": this.state.dlxExchange,
              "x-max-priority": RABBIT_MAX_PRIORITY,
            },
          },
    });

    return { consumerTag, queueName, routingKey };
  }

  protected async teardownConsumer(consumer: OwnedConsumer): Promise<void> {
    const channel = this.state.consumeChannel;

    if (channel) {
      try {
        await channel.unbindQueue(
          consumer.queueName,
          this.state.exchange,
          consumer.routingKey,
        );
      } catch {
        // Queue may already be gone
      }
      try {
        await channel.cancel(consumer.consumerTag);
      } catch {
        // Consumer may already be cancelled
      }
      this.state.assertedQueues.delete(consumer.queueName);
    }

    this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
      (r) => r.consumerTag !== consumer.consumerTag,
    );
  }
}
