import type { IMessage } from "../../../../interfaces";
import type { PublishOptions, SubscribeOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { RabbitSharedState } from "../types/rabbit-types";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase";
import { publishRabbitMessages } from "../utils/publish-messages";
import { wrapRabbitConsumer } from "../utils/wrap-rabbit-consumer";
import { resolveQueueName } from "../utils/resolve-queue-name";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key";

export type RabbitMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RabbitSharedState;
};

type OwnedSubscription = {
  consumerTag: string;
  queueName: string;
  routingKey: string;
};

export class RabbitMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly state: RabbitSharedState;
  private readonly ownedSubscriptions: Map<string, OwnedSubscription> = new Map();

  public constructor(options: RabbitMessageBusOptions<M>) {
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

  public async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError("Cannot subscribe: consume channel is not available");
    }

    const routingKey = sanitizeRoutingKey(options.topic);
    let queueName: string;

    if (options.queue) {
      queueName = resolveQueueName({
        exchange: this.state.exchange,
        topic: options.topic,
        queue: options.queue,
        type: "subscribe",
      })!;

      if (!this.state.assertedQueues.has(queueName)) {
        await channel.assertQueue(queueName, { durable: true });
        await channel.bindQueue(queueName, this.state.exchange, routingKey);
        this.state.assertedQueues.add(queueName);
      }
    } else {
      const result = await channel.assertQueue("", {
        exclusive: true,
        autoDelete: true,
      });
      queueName = result.queue;
      await channel.bindQueue(queueName, this.state.exchange, routingKey);
    }

    const wrappedCallback = wrapRabbitConsumer(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      options.callback,
      this.state,
      this.metadata,
      this.logger,
    );

    const { consumerTag } = await channel.consume(queueName, wrappedCallback);

    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    this.ownedSubscriptions.set(tagKey, { consumerTag, queueName, routingKey });

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage: wrappedCallback,
      routingKey,
      exchange: this.state.exchange,
      queueOptions: options.queue
        ? { durable: true }
        : { exclusive: true, autoDelete: true },
    });
  }

  public async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const tagKey = `${options.topic}:${options.queue ?? ""}`;
    const sub = this.ownedSubscriptions.get(tagKey);

    if (!sub) return;

    const channel = this.state.consumeChannel;
    if (channel) {
      // Unbind before cancelling so the exchange stops routing to this
      // queue immediately. Without this, the broker may still route
      // messages to the dying auto-delete queue during async cleanup,
      // causing publisher nacks.
      try {
        await channel.unbindQueue(sub.queueName, this.state.exchange, sub.routingKey);
      } catch {
        // Queue may already be gone
      }
      try {
        await channel.cancel(sub.consumerTag);
      } catch {
        // Consumer may already be cancelled
      }
    }

    this.state.assertedQueues.delete(sub.queueName);
    this.ownedSubscriptions.delete(tagKey);
    this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
      (r) => r.consumerTag !== sub.consumerTag,
    );
  }

  public async unsubscribeAll(): Promise<void> {
    const channel = this.state.consumeChannel;

    for (const [, sub] of this.ownedSubscriptions) {
      if (channel) {
        try {
          await channel.unbindQueue(sub.queueName, this.state.exchange, sub.routingKey);
        } catch {
          // Queue may already be gone
        }
        try {
          await channel.cancel(sub.consumerTag);
        } catch {
          // Consumer may already be cancelled
        }
      }
      this.state.assertedQueues.delete(sub.queueName);
      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== sub.consumerTag,
      );
    }

    this.ownedSubscriptions.clear();
  }
}
