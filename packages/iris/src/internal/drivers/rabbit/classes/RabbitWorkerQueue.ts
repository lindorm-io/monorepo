import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { RabbitSharedState } from "../types/rabbit-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverWorkerQueueBase } from "../../../classes/DriverWorkerQueueBase";
import { publishRabbitMessages } from "../utils/publish-messages";
import { wrapRabbitConsumer } from "../utils/wrap-rabbit-consumer";
import { resolveQueueName } from "../utils/resolve-queue-name";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key";

export type RabbitWorkerQueueOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RabbitSharedState;
};

type OwnedConsumer = {
  consumerTag: string;
  queueName: string;
  routingKey: string;
};

export class RabbitWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly state: RabbitSharedState;
  private readonly ownedConsumers: Map<string, Array<OwnedConsumer>> = new Map();

  public constructor(options: RabbitWorkerQueueOptions<M>) {
    super(options);
    this.state = options.state;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRabbitMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
      },
      this.state,
      this.logger,
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

    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError("Cannot consume: consume channel is not available");
    }

    let queueName: string;
    const routingKey = sanitizeRoutingKey(queue);

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
      })!;

      if (!this.state.assertedQueues.has(queueName)) {
        await channel.assertQueue(queueName, {
          durable: true,
          arguments: {
            "x-dead-letter-exchange": this.state.dlxExchange,
          },
        });
        await channel.bindQueue(queueName, this.state.exchange, routingKey);
        this.state.assertedQueues.add(queueName);
      }
    }

    const wrappedCallback = wrapRabbitConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      cb,
      this.state,
      this.metadata,
      this.logger,
    );

    const { consumerTag } = await channel.consume(queueName, wrappedCallback);

    const existing = this.ownedConsumers.get(queue) ?? [];
    existing.push({ consumerTag, queueName, routingKey });
    this.ownedConsumers.set(queue, existing);

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
            },
          },
    });
  }

  public async unconsume(queue: string): Promise<void> {
    const consumers = this.ownedConsumers.get(queue);
    if (!consumers || consumers.length === 0) return;

    const channel = this.state.consumeChannel;

    for (const consumer of consumers) {
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
      }
      this.state.assertedQueues.delete(consumer.queueName);
      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== consumer.consumerTag,
      );
    }

    this.ownedConsumers.delete(queue);
  }

  public async unconsumeAll(): Promise<void> {
    const channel = this.state.consumeChannel;

    for (const [, consumers] of this.ownedConsumers) {
      for (const consumer of consumers) {
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

    this.ownedConsumers.clear();
  }
}
