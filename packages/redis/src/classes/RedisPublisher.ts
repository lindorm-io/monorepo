import { isArray } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageKit } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { Redis } from "ioredis";
import { IRedisPublisher } from "../interfaces/RedisPublisher";
import { PublishOptions, RedisPublisherOptions } from "../types";

export class RedisPublisher<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRedisPublisher<M, O> {
  private readonly client: Redis;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;

  public constructor(options: RedisPublisherOptions<M>) {
    this.logger = options.logger.child(["RedisPublisher", options.target.name]);

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.client = options.client;
  }

  public create(options: O | M): M {
    return this.kit.create(options);
  }

  public copy(message: M): M {
    return this.kit.copy(message);
  }

  public async publish(
    message: O | M | Array<O | M>,
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
}
