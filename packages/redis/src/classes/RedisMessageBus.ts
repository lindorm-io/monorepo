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
import { IRedisPublisher } from "../interfaces";
import { IRedisMessageBus } from "../interfaces/RedisMessageBus";
import { PublishOptions, RedisMessageBusOptions } from "../types";
import { RedisPublisher } from "./RedisPublisher";

export class RedisMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRedisMessageBus<M, O> {
  private readonly client: Redis;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly publisher: IRedisPublisher<M, O>;
  private readonly subscriptions: IMessageSubscriptions;

  public constructor(options: RedisMessageBusOptions<M>) {
    this.logger = options.logger.child(["RedisMessageBus", options.target.name]);

    this.publisher = new RedisPublisher<M, O>({
      client: options.client,
      logger: this.logger,
      target: options.target,
    });

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.client = options.client;
    this.subscriptions = options.subscriptions;
  }

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

    await poll("0");
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
