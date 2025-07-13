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
import { randomBytes } from "crypto";
import { Consumer, Kafka, Producer } from "kafkajs";
import { IKafkaDelayService, IKafkaMessageBus } from "../interfaces";
import { KafkaBusOptions, PublishOptions, PublishWithDelayOptions } from "../types";

export class KafkaMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IKafkaMessageBus<M>
{
  private readonly consumers: Map<string, Consumer>;
  private readonly kafka: Kafka;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly producer: Producer;
  private readonly delayService: IKafkaDelayService;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: KafkaBusOptions<M>) {
    this.logger = options.logger.child(["KafkaMessageBus", options.target.name]);

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.consumers = new Map();
    this.delayService = options.delayService;
    this.kafka = options.kafka;
    this.producer = options.producer;
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
      m instanceof this.kit.metadata.message.target ? m : this.create(m),
    );

    this.logger.verbose("Publishing messages", { messages });

    for (const msg of messages) {
      this.kit.validate(msg);
      await this.handlePublish(this.kit.publish(msg), options);
    }
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

  public async disconnect(): Promise<void> {
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
    const value = JsonKit.buffer(message);
    const topic = this.kit.getTopicName(message, options);
    const config = this.getPublishConfig(message, options);

    await this.producer.connect();
    await this.producer.send({
      topic,
      messages: [{ ...config, value }],
    });

    this.kit.onPublish(message);
  }

  private async handlePublishMessageWithDelay(
    message: M,
    options: PublishWithDelayOptions,
  ): Promise<void> {
    const value = JsonKit.buffer(message);
    const topic = this.kit.getTopicName(message, options);
    const config = this.getPublishConfig(message, options);

    this.delayService.delay({
      delay: options.delay,
      key: config.key,
      topic,
      value,
    });

    this.kit.onPublish(message);
  }

  private async handleSubscribe(options: SubscribeOptions<M>): Promise<void> {
    const subscription: IMessageSubscription = {
      callback: options.callback,
      consumerTag: options.consumerTag ?? randomBytes(16).toString("base64url"),
      queue: options.queue ?? `queue.${options.topic}`,
      target: this.kit.metadata.message.target,
      topic: options.topic,
    };

    const consumer = this.kafka.consumer({ groupId: subscription.queue });

    await consumer.connect();
    await consumer.subscribe({ topic: subscription.topic, fromBeginning: false });
    await consumer.run({
      eachMessage: async (msg) => {
        const parsed = JsonKit.parse<M>(msg.message.value);

        this.logger.debug("Subscription consuming parsed message", {
          subscription: subscription,
          parsed,
        });

        const message = this.create(parsed);

        try {
          await subscription.callback(message);
          this.logger.debug("Message acknowledged", { message });
          this.kit.onConsume(message);
        } catch (err: any) {
          this.logger.error("Subscription callback error", err);
          throw err;
        }
      },
    });

    this.logger.debug("Subscription created", {
      consumerTag: subscription.consumerTag,
      queue: subscription.queue,
      topic: subscription.topic,
    });

    this.delayService.poll(subscription.topic, async (envelope) => {
      await this.producer.connect();
      await this.producer.send({
        topic: envelope.topic,
        messages: [
          {
            key: envelope.key,
            value: envelope.value,
            timestamp: envelope.timestamp.toString(),
          },
        ],
      });
    });

    this.consumers.set(subscription.consumerTag, consumer);
    this.subscriptions.add(subscription);
  }

  private async handleUnsubscribe(subscription: UnsubscribeOptions): Promise<void> {
    const { queue, topic } = subscription;

    const found = this.subscriptions.find(subscription);

    if (!found) {
      this.logger.warn("Subscription not found for unsubscribe", { queue, topic });
      return;
    }

    this.delayService.stop(topic);

    const { consumerTag } = found;

    const consumer = this.consumers.get(consumerTag);

    if (!consumer) return;

    await consumer.stop();
    await consumer.disconnect();

    this.consumers.delete(consumerTag);

    this.subscriptions.remove(found);

    this.logger.debug("Unsubscribe successful", { consumerTag, queue, topic });
  }

  private async handleUnsubscribeAll(): Promise<void> {
    this.logger.verbose("Removing all subscriptions");

    for (const subscription of this.subscriptions.all(this.kit.metadata.message.target)) {
      await this.handleUnsubscribe(subscription);
    }
  }

  private getPublishConfig(message: M, options: PublishOptions = {}): PublishOptions {
    const result: PublishOptions = {};

    const identifier = this.kit.metadata.fields.find(
      (f) => f.decorator === "IdentifierField",
    );
    if (identifier) {
      result.key = message[identifier.key];
    }

    const timestamp = this.kit.metadata.fields.find(
      (f) => f.decorator === "TimestampField",
    );
    if (timestamp) {
      result.timestamp = message[timestamp.key]?.getTime().toString();
    }

    return { ...result, ...options };
  }
}
