import { isArray } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import {
  IMessage,
  IMessageSubscription,
  IMessageSubscriptions,
  MessageKit,
  SubscribeOptions,
  UnsubscribeOptions,
} from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { randomBytes } from "crypto";
import { IRabbitMessageBus, IRabbitPublisher } from "../interfaces";
import { PublishOptions, RabbitMessageBusOptions } from "../types";
import { bindQueue } from "../utils";
import { RabbitPublisher } from "./RabbitPublisher";

export class RabbitMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRabbitMessageBus<M>
{
  private readonly channel: ConfirmChannel;
  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly nackTimeout: number;
  private readonly publisher: IRabbitPublisher<M>;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: RabbitMessageBusOptions<M>) {
    this.logger = options.logger.child(["RabbitMessageBus", options.target.name]);

    this.publisher = new RabbitPublisher<M, O>({
      channel: options.channel,
      exchange: options.exchange,
      logger: options.logger,
      target: options.target,
    });

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.channel = options.channel;
    this.deadletters = options.deadletters;
    this.exchange = options.exchange;
    this.nackTimeout = options.nackTimeout;
    this.subscriptions = options.subscriptions;
  }

  // public

  public create(options: O | M): M {
    return this.publisher.create(options);
  }

  public copy(message: M): M {
    return this.publisher.copy(message);
  }

  public async publish(
    message: O | M | Array<O | M>,
    options: PublishOptions = {},
  ): Promise<void> {
    return this.publisher.publish(message, options);
  }

  public async subscribe(
    subscription: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    const array = isArray(subscription) ? subscription : [subscription];

    this.logger.verbose("Subscribing to messages", { subscriptions: array });

    for (const subscription of array) {
      await this.handleSubscribe(subscription);
    }
  }

  public async unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void> {
    const array = isArray(subscription) ? subscription : [subscription];

    this.logger.verbose("Unsubscribing from messages", { subscriptions: array });

    for (const subscription of array) {
      await this.handleUnsubscribe(subscription);
    }
  }

  public async unsubscribeAll(): Promise<void> {
    await this.handleUnsubscribeAll();
  }

  // private

  private async handleSubscribe(options: SubscribeOptions<M>): Promise<void> {
    const subscription: IMessageSubscription = {
      callback: options.callback,
      consumerTag: options.consumerTag ?? randomBytes(16).toString("base64url"),
      queue: options.queue ?? `queue.${options.topic}`,
      target: this.kit.metadata.message.target,
      topic: options.topic,
    };

    await bindQueue(
      {
        channel: this.channel,
        exchange: this.exchange,
        logger: this.logger,
        queue: subscription.queue,
        topic: subscription.topic,
      },
      {
        deadLetterExchange: this.exchange,
        deadLetterRoutingKey: this.deadletters,
      },
    );

    await this.channel.consume(subscription.queue, (msg) => {
      if (!msg) return;

      const parsed = JsonKit.parse<M>(msg.content);

      this.logger.debug("Subscription consuming parsed message", {
        subscription: subscription,
        parsed,
      });

      const message = this.create(parsed);

      return subscription
        .callback(message)
        .then(
          () => {
            this.logger.debug("Message acknowledged", { message });
            this.channel.ack(msg);
            this.kit.onConsume(message);
          },
          (reason): Promise<void> =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  this.logger.debug("Message not acknowledged", { message, reason });
                  this.channel.nack(msg, false, true);
                  resolve();
                } catch (err) {
                  reject(err as Error);
                }
              }, this.nackTimeout);
            }),
        )
        .catch((err: Error) => {
          this.logger.error("Subscription callback error", err);
        });
    });

    this.logger.debug("Subscription created", {
      consumerTag: subscription.consumerTag,
      queue: subscription.queue,
      topic: subscription.topic,
    });

    this.subscriptions.add(subscription);
  }

  private async handleUnsubscribe(subscription: UnsubscribeOptions): Promise<void> {
    const { queue, topic } = subscription;

    const found = this.subscriptions.find(subscription);

    if (!found) {
      this.logger.warn("Subscription not found for unsubscribe", { queue, topic });
      return;
    }

    const { consumerTag } = found;

    await this.channel.cancel(consumerTag);

    this.subscriptions.remove(found);

    this.logger.debug("Unsubscribe successful", { consumerTag, queue, topic });
  }

  private async handleUnsubscribeAll(): Promise<void> {
    this.logger.verbose("Removing all subscriptions");

    for (const subscription of this.subscriptions.all(this.kit.metadata.message.target)) {
      await this.handleUnsubscribe(subscription);
    }
  }
}
