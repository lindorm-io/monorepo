import { isArray } from "@lindorm/is";
import { JsonKit } from "@lindorm/json-kit";
import { ILogger } from "@lindorm/logger";
import { IMessage, MessageKit } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { ConfirmChannel } from "amqplib";
import { IRabbitPublisher } from "../interfaces";
import {
  PublishOptions,
  PublishWithDelayOptions,
  RabbitPublisherOptions,
} from "../types";
import { sanitizeRouteKey } from "../utils";

export class RabbitPublisher<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> implements IRabbitPublisher<M>
{
  private readonly channel: ConfirmChannel;
  private readonly exchange: string;
  private readonly kit: MessageKit<M, O>;
  private readonly logger: ILogger;

  public constructor(options: RabbitPublisherOptions<M>) {
    this.logger = options.logger.child(["RabbitPublisher", options.target.name]);

    this.kit = new MessageKit<M, O>({ target: options.target, logger: this.logger });

    this.channel = options.channel;
    this.exchange = options.exchange;
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
    const content = JsonKit.buffer(message);
    const topic = this.kit.getTopicName(message, options);
    const config = this.getPublishConfig(message, options);

    return new Promise((resolve, reject) => {
      this.channel.publish(this.exchange, topic, content, config, (err) => {
        if (err) {
          this.logger.error("Channel Publish failed", err);
          reject(err as Error);
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
          reject(err as Error);
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

    result.type = this.kit.metadata.message.name;

    return { ...result, ...options };
  }
}
