import { ConnectionStatus } from "@lindorm-io/core-connection";
import { Logger } from "@lindorm-io/core-logger";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import { sanitizeRouteKey } from "../util";
import {
  IAmqpConnection,
  IMessage,
  IMessageBus,
  ISubscription,
  LindormMessageBusOptions,
  SubscriptionData,
  UnsubscribeOptions,
} from "../types";

export abstract class MessageBusBase<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> implements IMessageBus<Message, Subscription>
{
  private readonly connection: IAmqpConnection;
  private readonly nackTimeout: number;
  private isConnected: boolean;
  private subscriptions: Array<SubscriptionData<Subscription>>;

  protected readonly logger: Logger;

  protected constructor(options: LindormMessageBusOptions) {
    const { connection, nackTimeout = 3000 } = options;

    this.connection = connection;
    this.isConnected = false;
    this.logger = options.logger.createChildLogger(["MessageBus", this.constructor.name]);
    this.nackTimeout = nackTimeout;
    this.subscriptions = [];

    this.connection.on(ConnectionStatus.CONNECTED, this.onConnected.bind(this));
    this.connection.on(ConnectionStatus.DISCONNECTED, this.onDisconnected.bind(this));

    this.onConnected().then();
  }

  // abstract

  protected abstract createMessage(message: Message): any;

  protected abstract validateMessage(message: Message): Promise<void>;

  protected abstract validateSubscription(subscription: Subscription): Promise<void>;

  // public

  public async publish(messages: Message | Array<Message>): Promise<void> {
    await this.connection.connect();

    const array = Array.isArray(messages) ? messages : [messages];

    this.logger.verbose("Publishing messages", {
      messages: array,
    });

    for (const message of array) {
      await this.validateMessage(message);
      await this.handleMessage(message);
    }
  }

  public async subscribe(subscriptions: Subscription | Array<Subscription>): Promise<void> {
    await this.connection.connect();

    const array = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

    this.logger.verbose("Creating subscriptions", {
      subscriptions: array,
    });

    for (const subscription of array) {
      await this.validateSubscription(subscription);
      await this.handleSubscription(subscription);
    }
  }

  public async unsubscribe(
    subscriptions: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void> {
    await this.connection.connect();

    const array = Array.isArray(subscriptions) ? subscriptions : [subscriptions];

    this.logger.verbose("Removing subscriptions", {
      subscriptions: array,
    });

    for (const subscription of array) {
      await this.handleUnsubscribe(subscription);
    }
  }

  public async unsubscribeAll(): Promise<void> {
    await this.connection.connect();

    this.logger.verbose("Removing all subscriptions");

    for (const subscription of this.subscriptions) {
      await this.handleUnsubscribe(subscription);
    }
  }

  // private

  private async handleMessage(message: Message): Promise<void> {
    if (message.delay > 0) {
      return this.publishMessageWithDelay(message);
    }

    return this.publishMessage(message);
  }

  private async handleSubscription(subscription: Subscription): Promise<void> {
    const queue = sanitizeRouteKey(subscription.queue);
    const topic = sanitizeRouteKey(subscription.topic);

    await this.connection.bindQueue(queue, topic, {
      deadLetterExchange: this.connection.exchange,
      deadLetterRoutingKey: this.connection.deadLetters,
    });

    const { consumerTag } = await this.connection.channel.consume(queue, (msg) => {
      if (!msg) return;

      const message = this.createMessage(parseBlob(msg.content.toString()) as Message);

      this.logger.debug("Subscription consuming message", {
        subscription,
        message,
      });

      return subscription
        .callback(message)
        .then(
          () => {
            this.connection.channel.ack(msg);
            this.logger.debug("Message acknowledged", { message });
          },
          (reason): Promise<void> =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  this.logger.debug("Message not acknowledged", { message, reason });
                  this.connection.channel.nack(msg, false, true);
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

    this.subscriptions.push({ consumerTag, queue, topic, subscription });
  }

  private async handleUnsubscribe(subscription: UnsubscribeOptions): Promise<void> {
    const { queue, topic } = subscription;

    const found = this.subscriptions.find((s) => s.queue === queue && s.topic === topic);

    if (!found) {
      this.logger.debug("Unsubscribe unsuccessful", { queue, topic });
      return;
    }

    const { consumerTag } = found;

    await this.connection.channel.cancel(consumerTag);

    this.subscriptions = this.subscriptions.filter((x) => x.consumerTag !== consumerTag);

    this.logger.debug("Unsubscribe successful", { consumerTag, queue, topic });
  }

  private async publishMessage(message: Message): Promise<void> {
    const content = Buffer.from(stringifyBlob(message));
    const topic = sanitizeRouteKey(message.topic);

    return new Promise((resolve, reject) => {
      this.connection.channel.publish(
        this.connection.exchange,
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

  private async publishMessageWithDelay(message: Message): Promise<void> {
    const content = Buffer.from(stringifyBlob(message));
    const topic = sanitizeRouteKey(message.topic);
    const delayQueue = sanitizeRouteKey(`${message.topic}.delayed`);

    await this.connection.channel.assertQueue(delayQueue, {
      durable: true,
      deadLetterExchange: this.connection.exchange,
      deadLetterRoutingKey: topic,
    });

    return new Promise((resolve, reject) => {
      this.connection.channel.publish(
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
            this.logger.debug("Message published with delay", { message, delayQueue, topic });
            resolve();
          }
        },
      );
    });
  }

  // private event handlers

  private async onConnected(): Promise<void> {
    if (this.isConnected) return;

    for (const data of this.subscriptions) {
      await this.handleSubscription(data.subscription);
    }

    this.isConnected = true;
  }

  private onDisconnected(): void {
    this.isConnected = false;
  }
}
