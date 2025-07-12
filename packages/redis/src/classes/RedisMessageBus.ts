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
import { DeepPartial, Dict } from "@lindorm/types";
import { randomBytes } from "crypto";
import { Redis } from "ioredis";
import { IRedisMessageBus } from "../interfaces/RedisMessageBus";
import { PublishOptions, RedisMessageBusOptions } from "../types";

export class RedisMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRedisMessageBus<M, O>
{
  private readonly client: Redis;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: RedisMessageBusOptions<M>) {
    this.logger = options.logger.child(["RedisMessageBus", options.target.name]);
    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.client = options.client;
    this.subscriptions = options.subscriptions;
  }

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
    const streamKey = this.kit.getTopicName(message, options);

    this.logger.debug("Publishing to Redis stream", { streamKey, message });

    await this.client.xadd(streamKey, "*", "message", JsonKit.stringify(message));

    this.kit.onPublish(message);
  }

  private async handlePublishMessageWithDelay(
    message: M,
    options: PublishOptions & { delay: number },
  ): Promise<void> {
    const name = this.kit.metadata.message.name;
    const streamKey = this.kit.getTopicName(message, options);
    const delayedKey = `delayed:${streamKey}`;
    const deliveryTime = Date.now() + options.delay;

    this.logger.debug("Storing delayed message in Redis ZSET", {
      delayedKey,
      deliveryTime,
      message,
    });

    await this.client.zadd(
      delayedKey,
      deliveryTime.toString(),
      JsonKit.stringify({ message, name, streamKey }),
    );

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

    const consumerGroup =
      subscription.consumerTag ?? randomBytes(16).toString("base64url");
    const streamKey = subscription.topic;
    const group = subscription.queue;

    if (this.subscriptions.find(subscription)) return;

    try {
      const result = await this.client.xgroup(
        "CREATE",
        streamKey,
        group,
        "0",
        "MKSTREAM",
      );

      this.logger.debug("Created new consumer group", { streamKey, group, result });
    } catch (err: any) {
      if (/BUSYGROUP/.test(err?.message)) {
        this.logger.warn("Consumer group already exists", { streamKey, group });
      } else {
        throw err;
      }
    }

    this.subscriptions.add(subscription);

    const poll = async (position: "0" | ">" = ">"): Promise<void> => {
      if (!this.subscriptions.find(subscription)) return;

      try {
        const response: any = await this.client.xreadgroup(
          "GROUP",
          group,
          consumerGroup,
          "COUNT",
          "500",
          "BLOCK",
          "100",
          "STREAMS",
          streamKey,
          position,
        );

        this.logger.debug("xreadgroup response", {
          consumerGroup,
          group,
          response,
          streamKey,
        });

        if (response) {
          for (const [_, messages] of response) {
            for (const [id, entry] of messages) {
              const map: Dict<string> = {};

              for (let i = 0; i < entry.length; i += 2) {
                map[entry[i]] = entry[i + 1];
              }

              const raw = map["message"];

              if (!raw) continue;

              const message = this.create(JsonKit.parse<M>(raw));

              this.logger.debug("Calling subscription callback with parsed message", {
                id,
                message,
              });

              try {
                await subscription.callback(message);
                await this.client.xack(streamKey, group, id);

                this.kit.onConsume(message);
              } catch (error: any) {
                this.logger.error("Subscription callback error", error);
              }
            }
          }
        }
      } catch (err: any) {
        this.logger.error("xreadgroup error", err);
      } finally {
        setImmediate(poll);
      }
    };

    poll("0");
  }

  private async handleUnsubscribe(subscription: UnsubscribeOptions): Promise<void> {
    const { queue, topic } = subscription;

    const found = this.subscriptions.find(subscription);

    if (!found) {
      this.logger.warn("Subscription not found for unsubscribe", { queue, topic });
      return;
    }

    this.subscriptions.remove(found);
  }

  private async handleUnsubscribeAll(): Promise<void> {
    for (const subscription of this.subscriptions.all(this.kit.metadata.message.target)) {
      await this.handleUnsubscribe(subscription);
    }
  }
}
