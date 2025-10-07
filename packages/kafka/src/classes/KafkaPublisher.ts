import { isArray } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageKit } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { Producer } from "kafkajs";
import { IKafkaDelayService, IKafkaPublisher } from "../interfaces";
import { KafkaPublisherOptions, PublishOptions, PublishWithDelayOptions } from "../types";

export class KafkaPublisher<M extends IMessage, O extends DeepPartial<M> = DeepPartial<M>>
  implements IKafkaPublisher<M>
{
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;
  private readonly producer: Producer;
  private readonly delayService: IKafkaDelayService;

  public constructor(options: KafkaPublisherOptions<M>) {
    this.logger = options.logger.child(["KafkaPublisher", options.target.name]);

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.delayService = options.delayService;
    this.producer = options.producer;
  }

  // public

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

    await this.delayService.delay({
      delay: options.delay,
      key: config.key,
      topic,
      value,
    });

    this.kit.onPublish(message);
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
