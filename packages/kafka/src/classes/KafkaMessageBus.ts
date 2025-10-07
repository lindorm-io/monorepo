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
import { IKafkaDelayService, IKafkaMessageBus, IKafkaPublisher } from "../interfaces";
import { KafkaMessageBusOptions, PublishOptions } from "../types";
import { KafkaPublisher } from "./KafkaPublisher";

export class KafkaMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IKafkaMessageBus<M>
{
  private readonly consumers: Map<string, Consumer>;
  private readonly delayService: IKafkaDelayService;
  private readonly kafka: Kafka;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly producer: Producer;
  private readonly publisher: IKafkaPublisher<M>;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: KafkaMessageBusOptions<M>) {
    this.logger = options.logger.child(["KafkaMessageBus", options.target.name]);

    this.publisher = new KafkaPublisher<M, O>({
      delayService: options.delayService,
      logger: options.logger,
      producer: options.producer,
      target: options.target,
    });

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.consumers = new Map();
    this.delayService = options.delayService;
    this.kafka = options.kafka;
    this.producer = options.producer;
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

  public async disconnect(): Promise<void> {
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

    await this.delayService.stop(topic);

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
}
