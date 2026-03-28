import type { ConsumeMessage } from "amqplib";
import type { RabbitSharedState } from "../types/rabbit-types";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic";
import { buildAmqpHeaders } from "../utils/build-amqp-headers";
import { parseAmqpHeaders } from "../utils/parse-amqp-headers";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase";

export type RabbitStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: RabbitSharedState;
};

export class RabbitStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: RabbitSharedState;
  private consumerTag: string | null = null;
  private subscribedQueue: string | null = null;
  private subscribedRoutingKey: string | null = null;
  private wrappedOnMessage: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

  public constructor(options: RabbitStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["RabbitStreamPipeline"]),
    });
    this.state = options.state;
  }

  public async start(): Promise<void> {
    if (this.running) {
      const subscriptionExists =
        this.consumerTag != null &&
        this.state.consumerRegistrations.some((r) => r.consumerTag === this.consumerTag);

      if (subscriptionExists) return;

      this.running = false;
      this.consumerTag = null;
      this.subscribedQueue = null;
    }

    if (!this.inputClass) {
      throw new IrisDriverError(
        "Stream pipeline requires an input class. Call .from() before .to().",
      );
    }

    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError(
        "Cannot start stream pipeline: consume channel is not available",
      );
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const routingKey = sanitizeRoutingKey(subscribeTopic);

    const result = await channel.assertQueue("", {
      exclusive: true,
      autoDelete: true,
    });
    const queueName = result.queue;
    await channel.bindQueue(queueName, this.state.exchange, routingKey);

    this.running = true;
    this.subscribedQueue = queueName;
    this.subscribedRoutingKey = routingKey;

    const onMessage = async (msg: ConsumeMessage | null): Promise<void> => {
      if (!msg) return;

      try {
        await this.processMessage(msg);
        channel.ack(msg);
      } catch (error) {
        this.logger.warn("Stream pipeline processing error", {
          error: error instanceof Error ? error.message : String(error),
          topic: subscribeTopic,
        });
        channel.nack(msg, false, false);
      }
    };

    this.wrappedOnMessage = onMessage;

    if (this.paused) {
      this.logger.debug("Stream pipeline started in paused state", {
        topic: subscribeTopic,
        stageCount: this.stages.length,
      });
      return;
    }

    const { consumerTag } = await channel.consume(queueName, onMessage);

    this.consumerTag = consumerTag;

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage,
      routingKey,
      exchange: this.state.exchange,
      queueOptions: { exclusive: true, autoDelete: true },
    });

    this.logger.debug("Stream pipeline started", {
      consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  public async stop(): Promise<void> {
    if (!this.running) return;

    this.paused = false;

    if (this.consumerTag) {
      const channel = this.state.consumeChannel;
      if (channel) {
        try {
          await channel.cancel(this.consumerTag);
        } catch {
          // Channel may already be closed
        }
      }

      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== this.consumerTag,
      );
      this.consumerTag = null;
      this.subscribedQueue = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    await this.flushBatchBuffer();

    this.running = false;

    this.logger.debug("Stream pipeline stopped");
  }

  public async pause(): Promise<void> {
    if (this.paused) return;
    this.paused = true;

    if (this.consumerTag) {
      const channel = this.state.consumeChannel;
      if (channel) {
        if (this.subscribedQueue && this.subscribedRoutingKey) {
          try {
            await channel.unbindQueue(
              this.subscribedQueue,
              this.state.exchange,
              this.subscribedRoutingKey,
            );
          } catch {
            // Queue may already be gone
          }
        }
        try {
          await channel.cancel(this.consumerTag);
        } catch {
          // Channel may already be closed
        }
      }

      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== this.consumerTag,
      );
      this.consumerTag = null;
    }

    this.logger.debug("Stream pipeline paused");
  }

  public async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.wrappedOnMessage || !this.subscribedRoutingKey) return;

    const channel = this.state.consumeChannel;
    if (!channel) {
      this.logger.warn("Cannot resume stream pipeline: consume channel is not available");
      return;
    }

    const result = await channel.assertQueue("", {
      exclusive: true,
      autoDelete: true,
    });
    const queueName = result.queue;
    await channel.bindQueue(queueName, this.state.exchange, this.subscribedRoutingKey);
    this.subscribedQueue = queueName;

    const { consumerTag } = await channel.consume(queueName, this.wrappedOnMessage);

    this.consumerTag = consumerTag;

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage: this.wrappedOnMessage,
      routingKey: this.subscribedRoutingKey,
      exchange: this.state.exchange,
      queueOptions: { exclusive: true, autoDelete: true },
    });

    this.logger.debug("Stream pipeline resumed", { consumerTag });
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    _topic: string,
  ): Promise<void> {
    const { properties, routingKey } = buildAmqpHeaders(envelope, envelope.headers);

    const publishChannel = this.state.publishChannel;
    if (!publishChannel) {
      this.logger.warn("Cannot publish stream output: publish channel is not available");
      return;
    }

    await new Promise<void>((resolve, reject) => {
      publishChannel.publish(
        this.state.exchange,
        routingKey,
        envelope.payload,
        properties,
        (err) => {
          if (err) reject(err instanceof Error ? err : new Error(String(err)));
          else resolve();
        },
      );
    });
  }

  private async processMessage(msg: ConsumeMessage): Promise<void> {
    if (!this.running) return;

    const parsed = parseAmqpHeaders(msg);
    await this.processInboundData(
      parsed.payload,
      parsed.headers,
      parsed.envelope.topic ?? "unknown",
    );
  }
}
