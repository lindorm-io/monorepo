import { AmqpConnection } from "../connection";
import { ConnectionStatus } from "@lindorm-io/core-connection";
import { ILogger } from "@lindorm-io/winston";
import { IMessage, IMessageBus, ISubscription, LindormMessageBusOptions } from "../types";
import { isArray } from "lodash";
import { parseBlob, stringifyBlob } from "@lindorm-io/string-blob";
import { sanitizeRouteKey } from "../util";

export abstract class MessageBusBase<
  Message extends IMessage = IMessage,
  Subscription extends ISubscription = ISubscription,
> implements IMessageBus<Message, Subscription>
{
  private readonly connection: AmqpConnection;
  private readonly nackTimeout: number;
  private readonly subscriptions: Array<Subscription>;

  protected readonly logger: ILogger;

  private isConnected: boolean;

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

    if (isArray(messages)) {
      for (const message of messages) {
        await this.validateMessage(message);
        await this.handleMessage(message);
      }
    } else {
      await this.validateMessage(messages);
      await this.handleMessage(messages);
    }
  }

  public async subscribe(subscriptions: Subscription | Array<Subscription>): Promise<void> {
    await this.connection.connect();

    if (isArray(subscriptions)) {
      for (const subscription of subscriptions) {
        await this.validateSubscription(subscription);
        await this.handleSubscription(subscription);
        this.subscriptions.push(subscription);
      }
    } else {
      await this.validateSubscription(subscriptions);
      await this.handleSubscription(subscriptions);
      this.subscriptions.push(subscriptions);
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
    const routingKey = sanitizeRouteKey(subscription.routingKey);

    await this.connection.bindQueue(queue, routingKey, {
      deadLetterExchange: this.connection.exchange,
      deadLetterRoutingKey: this.connection.deadLetters,
    });

    await this.connection.channel.consume(queue, (msg) => {
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
          (): Promise<void> =>
            new Promise((resolve, reject) => {
              setTimeout(() => {
                try {
                  this.logger.debug("Message not acknowledged", { message });
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

    this.logger.debug("Subscription created", { subscription });
  }

  private async publishMessage(message: Message): Promise<void> {
    const content = Buffer.from(stringifyBlob(message));
    const routingKey = sanitizeRouteKey(message.routingKey);

    this.connection.channel.publish(
      this.connection.exchange,
      routingKey,
      content,
      {
        persistent: true,
        mandatory: message.mandatory === true,
      },
      (err) => {
        if (err) {
          this.logger.error("Channel Publish failed", err);
        } else {
          this.logger.debug("Message published", { message, routingKey });
        }
      },
    );
  }

  private async publishMessageWithDelay(message: Message): Promise<void> {
    const content = Buffer.from(stringifyBlob(message));
    const routingKey = sanitizeRouteKey(message.routingKey);
    const delayQueue = sanitizeRouteKey(`${message.routingKey}.delayed`);

    await this.connection.channel.assertQueue(delayQueue, {
      durable: true,
      deadLetterExchange: this.connection.exchange,
      deadLetterRoutingKey: routingKey,
    });

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
        } else {
          this.logger.debug("Message published with delay", { message, delayQueue, routingKey });
        }
      },
    );
  }

  // private event handlers

  private async onConnected(): Promise<void> {
    if (this.isConnected) return;

    for (const subscription of this.subscriptions) {
      await this.handleSubscription(subscription);
    }

    this.isConnected = true;
  }

  private onDisconnected(): void {
    this.isConnected = false;
  }
}
