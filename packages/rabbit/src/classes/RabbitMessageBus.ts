import { isArray } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageKit } from "@lindorm/message";
import { Constructor, DeepPartial } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { IRabbitMessageBus, IRabbitSubscription } from "../interfaces";
import {
  PublishOptions,
  PublishWithDelayOptions,
  RabbitBusOptions,
  UnsubscribeOptions,
} from "../types";
import { bindQueue, sanitizeRouteKey } from "../utils";
import { SubscriptionList } from "./private";

export class RabbitMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRabbitMessageBus<M>
{
  private readonly MessageConstructor: Constructor<M>;
  private readonly channel: ConfirmChannel;
  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly nackTimeout: number;
  private readonly subscriptions: SubscriptionList;

  public constructor(options: RabbitBusOptions<M>) {
    this.logger = options.logger.child(["RabbitMessageBus", options.Message.name]);

    this.kit = new MessageKit<M, O>({ Message: options.Message, logger: this.logger });

    this.MessageConstructor = options.Message;
    this.channel = options.channel;
    this.deadletters = options.deadletters;
    this.exchange = options.exchange;
    this.nackTimeout = options.nackTimeout;
    this.subscriptions = options.subscriptions;
  }

  // public

  public create(options: O | M): M {
    return this.kit.create(options);
  }

  public copy(message: M): M {
    return this.kit.copy(message);
  }

  public async publish(
    message: M | Array<M>,
    options: PublishOptions = {},
  ): Promise<void> {
    const array = isArray(message) ? message : [message];

    const messages = array.map((m) =>
      m instanceof this.MessageConstructor ? m : this.create(m),
    );

    this.logger.verbose("Publishing messages", { messages });

    for (const msg of messages) {
      this.kit.validate(msg);
      await this.handlePublish(this.kit.publish(msg), options);
    }
  }

  public async subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
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

  private async handlePublish(message: M, options: PublishOptions = {}): Promise<void> {
    const delayField = this.kit.metadata.fields.find((f) => f.decorator === "DelayField");
    const delay: number = delayField ? message[delayField.key] : options.delay;

    if (delay && delay > 0) {
      return this.handlePublishMessageWithDelay(message, { ...options, delay });
    }

    return this.handlePublishMessage(message, options);
  }

  private async handlePublishMessage(
    message: M,
    options: PublishOptions = {},
  ): Promise<void> {
    const content = JsonKit.buffer(message);
    const topic = this.kit.getTopicName(message, options);
    const config = this.getPublishConfig(message, options);

    return new Promise((resolve, reject) => {
      this.channel.publish(this.exchange, topic, content, config, (err) => {
        if (err) {
          this.logger.error("Channel Publish failed", err);
          reject(err);
        } else {
          this.logger.debug("Message published", { message, topic });
          this.kit.onPublish(message);
          resolve();
        }
      });
    });
  }

  private async handlePublishMessageWithDelay(
    message: M,
    options: PublishWithDelayOptions,
  ): Promise<void> {
    const content = JsonKit.buffer(message);
    const topic = this.kit.getTopicName(message, options);
    const topicDelayed = sanitizeRouteKey(`${topic}.delayed`);
    const config = this.getPublishConfig(message, {
      ...options,
      expiration: options.delay,
    });

    await this.channel.assertQueue(topicDelayed, {
      durable: true,
      deadLetterExchange: this.exchange,
      deadLetterRoutingKey: topic,
    });

    return new Promise((resolve, reject) => {
      this.channel.publish("", topicDelayed, content, config, (err) => {
        if (err) {
          this.logger.error("Channel Publish failed", err);
          reject(err);
        } else {
          this.logger.debug("Message published with delay", {
            message,
            topicDelayed,
            topic,
          });
          this.kit.onPublish(message);
          resolve();
        }
      });
    });
  }

  private async handleSubscribe(subscription: IRabbitSubscription<M>): Promise<void> {
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

    const { consumerTag } = await this.channel.consume(subscription.queue, (msg) => {
      if (!msg) return;

      const parsed = JsonKit.parse<M>(msg.content);

      this.logger.debug("Subscription consuming parsed message", {
        subscription,
        parsed,
      });

      const message = this.create(parsed);

      if (!(message instanceof this.MessageConstructor)) {
        this.logger.error("Invalid message instance", {
          actual: message.constructor.name,
          expect: this.MessageConstructor.name,
        });
        return this.channel.nack(msg, false, false);
      }

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
                  reject(err);
                }
              }, this.nackTimeout);
            }),
        )
        .catch((err: Error) => {
          this.logger.error("Subscription callback error", err);
        });
    });

    this.logger.debug("Subscription created", { consumerTag, subscription });

    this.subscriptions.add({
      Message: this.MessageConstructor,
      consumerTag,
      subscription,
    });
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

    for (const { subscription } of this.subscriptions.all(this.MessageConstructor)) {
      await this.handleUnsubscribe(subscription);
    }
  }

  private getPublishConfig(message: M, options: PublishOptions = {}): PublishOptions {
    const result: PublishOptions = {};

    const correlation = this.kit.metadata.fields.find(
      (f) => f.decorator === "CorrelationField",
    );
    if (correlation) {
      result.correlationId = message[correlation.key];
    }

    const identifier = this.kit.metadata.fields.find(
      (f) => f.decorator === "IdentifierField",
    );
    if (identifier) {
      result.messageId = message[identifier.key];
    }

    if (this.kit.metadata.priority) {
      result.priority = this.kit.metadata.priority;
    }
    const priorityField = this.kit.metadata.fields.find(
      (f) => f.decorator === "PriorityField",
    );
    if (priorityField) {
      result.priority = message[priorityField.key];
    }

    const persistent = this.kit.metadata.fields.find(
      (f) => f.decorator === "PersistentField",
    );
    if (persistent) {
      result.persistent = message[persistent.key] !== false;
    }

    const mandatory = this.kit.metadata.fields.find(
      (f) => f.decorator === "MandatoryField",
    );
    if (mandatory) {
      result.mandatory = message[mandatory.key] === true;
    }

    const timestamp = this.kit.metadata.fields.find(
      (f) => f.decorator === "TimestampField",
    );
    if (timestamp) {
      result.timestamp = message[timestamp.key]?.getTime();
    }

    result.type = this.MessageConstructor.name;

    return { ...result, ...options };
  }
}
