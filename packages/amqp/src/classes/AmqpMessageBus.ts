import { isArray, isFunction } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { Constructor, DeepPartial } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { randomUUID } from "crypto";
import { z } from "zod";
import { IAmqpMessage } from "../interfaces";
import { IAmqpMessageBus } from "../interfaces/AmqpMessageBus";
import { IAmqpSubscription } from "../interfaces/AmqpSubscription";
import { AmqpBusOptions, UnsubscribeOptions, ValidateMessageFn } from "../types";
import { bindQueue, sanitizeRouteKey } from "../utils";
import { SubscriptionList } from "./private";

export class AmqpMessageBus<
  M extends IAmqpMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IAmqpMessageBus<M>
{
  private readonly MessageConstructor: Constructor<M>;
  private readonly channel: ConfirmChannel;
  private readonly deadletters: string;
  private readonly exchange: string;
  private readonly logger: ILogger;
  private readonly nackTimeout: number;
  private readonly subscriptions: SubscriptionList;
  private readonly validate: ValidateMessageFn<M> | undefined;

  public constructor(options: AmqpBusOptions<M>) {
    this.logger = options.logger.child(["AmqpMessageBus", options.Message.name]);

    this.MessageConstructor = options.Message;
    this.channel = options.channel;
    this.deadletters = options.deadletters;
    this.exchange = options.exchange;
    this.nackTimeout = options.nackTimeout;
    this.subscriptions = options.subscriptions;
    this.validate = options.validate;
  }

  // public

  public create(options: O | M): M {
    const message = new this.MessageConstructor(options);

    message.id = (options.id as string) ?? message.id ?? randomUUID();
    message.delay = (options.delay as number) ?? message.delay ?? 0;
    message.mandatory = (options.mandatory as boolean) ?? message.mandatory ?? false;
    message.timestamp = (options.timestamp as Date) ?? message.timestamp ?? new Date();
    message.type =
      (options.type as string) ?? message.type ?? this.MessageConstructor.name;

    this.validateBaseMessage(message);

    this.logger.debug("Created message", { message });

    return message;
  }

  public async publish(message: M | Array<M>): Promise<void> {
    const array = isArray(message) ? message : [message];

    this.logger.verbose("Publishing messages", { messages: array });

    for (const message of array) {
      this.validateMessage(message);
      await this.handlePublish(message);
    }
  }

  public async subscribe(
    subscription: IAmqpSubscription<M> | Array<IAmqpSubscription<M>>,
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

  private async handlePublish(message: M): Promise<void> {
    this.validateBaseMessage(message);

    if (message.delay > 0) {
      return this.publishMessageWithDelay(message);
    }

    return this.publishMessage(message);
  }

  private async handleSubscribe(subscription: IAmqpSubscription<M>): Promise<void> {
    const queue = sanitizeRouteKey(subscription.queue);
    const topic = sanitizeRouteKey(subscription.topic);

    await bindQueue(
      {
        channel: this.channel,
        exchange: this.exchange,
        logger: this.logger,
        queue,
        topic,
      },
      {
        deadLetterExchange: this.exchange,
        deadLetterRoutingKey: this.deadletters,
      },
    );

    const { consumerTag } = await this.channel.consume(queue, (msg) => {
      if (!msg) return;

      const message = this.create(JsonKit.parse<M>(msg.content));

      this.logger.debug("Subscription consuming message", {
        subscription,
        message,
      });

      try {
        this.validateBaseMessage(message);
      } catch (error: any) {
        this.logger.error("Message validation error", error, [{ message }]);
        return this.channel.nack(msg, false, false);
      }

      if (message.type !== this.MessageConstructor.name) {
        this.logger.error("Message type mismatch", {
          message,
          expected: this.MessageConstructor.name,
        });
        return this.channel.nack(msg, false, false);
      }

      return subscription
        .callback(message)
        .then(
          () => {
            this.logger.debug("Message acknowledged", { message });
            this.channel.ack(msg);
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

    this.subscriptions.add({ consumerTag, queue, topic, subscription });
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

    for (const subscription of this.subscriptions.all) {
      await this.handleUnsubscribe(subscription);
    }
  }

  private async publishMessage(message: M): Promise<void> {
    const content = JsonKit.buffer(message);
    const topic = sanitizeRouteKey(message.topic);

    return new Promise((resolve, reject) => {
      this.channel.publish(
        this.exchange,
        topic,
        content,
        {
          persistent: true,
          mandatory: message.mandatory === true,
        },
        (err) => {
          if (err) {
            this.logger.error("Channel Publish failed", err);
            reject(err);
          } else {
            this.logger.debug("Message published", { message, topic });
            resolve();
          }
        },
      );
    });
  }

  private async publishMessageWithDelay(message: M): Promise<void> {
    const content = JsonKit.buffer(message);
    const topic = sanitizeRouteKey(message.topic);
    const delayQueue = sanitizeRouteKey(`${message.topic}.delayed`);

    await this.channel.assertQueue(delayQueue, {
      durable: true,
      deadLetterExchange: this.exchange,
      deadLetterRoutingKey: topic,
    });

    return new Promise((resolve, reject) => {
      this.channel.publish(
        "",
        delayQueue,
        content,
        {
          persistent: true,
          mandatory: message.mandatory === true,
          expiration: message.delay,
        },
        (err) => {
          if (err) {
            this.logger.error("Channel Publish failed", err);
            reject(err);
          } else {
            this.logger.debug("Message published with delay", {
              message,
              delayQueue,
              topic,
            });
            resolve();
          }
        },
      );
    });
  }

  private validateBaseMessage(message: IAmqpMessage): void {
    z.object({
      id: z.string().uuid(),
      delay: z.number().int().min(0),
      mandatory: z.boolean(),
      time: z.date(),
      topic: z.string().min(1),
      type: z.string().min(1),
    }).parse({
      id: message.id,
      delay: message.delay,
      mandatory: message.mandatory,
      time: message.timestamp,
      topic: message.topic,
      type: message.type,
    });
  }

  private validateMessage(message: M): void {
    this.validateBaseMessage(message);

    if (isFunction(this.validate)) {
      const { id, delay, mandatory, timestamp, topic, type, ...rest } = message;
      this.validate(rest);
    }
  }
}
