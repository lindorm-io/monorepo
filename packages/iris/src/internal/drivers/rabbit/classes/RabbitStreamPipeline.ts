import type { ConsumeMessage } from "amqplib";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { buildAmqpHeaders } from "../utils/build-amqp-headers.js";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key.js";
import { wrapRabbitConsumer } from "../utils/wrap-rabbit-consumer.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";

export type RabbitStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: RabbitSharedState;
};

export class RabbitStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: RabbitSharedState;
  private consumerTag: string | null = null;
  private subscribedQueue: string | null = null;
  private subscribedRoutingKey: string | null = null;
  private wrappedOnMessage: ((msg: ConsumeMessage | null) => Promise<void>) | null = null;

  constructor(options: RabbitStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["RabbitStreamPipeline"]),
    });
    this.state = options.state;
  }

  async start(): Promise<void> {
    if (this.running) {
      const subscriptionExists =
        this.consumerTag != null &&
        this.state.consumerRegistrations.some((r) => r.consumerTag === this.consumerTag);

      if (subscriptionExists) return;

      this.running = false;
      this.consumerTag = null;
      this.subscribedQueue = null;
    }

    this.assertInputClass();

    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError(
        "Cannot start stream pipeline: consume channel is not available",
        {
          code: "connection_unavailable",
          title: "Connection Unavailable",
          details:
            "The RabbitMQ consume channel is not available, so the stream pipeline cannot start.",
          data: { driver: "rabbit" },
        },
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

    const onMessage = this.buildOnMessage(inputMetadata, queueName);

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

  protected async doStopConsumer(): Promise<void> {
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
  }

  // On pause, unbind the exclusive queue (so no new messages arrive during the
  // pause window) and cancel the consumer. The base owns the batch-flush +
  // timer-clear — previously rabbit did neither, stranding buffered messages and
  // leaking the batch timer (M8). subscribedRoutingKey is retained so resume can
  // re-assert a fresh queue binding.
  protected async doPauseConsumer(): Promise<void> {
    if (!this.consumerTag) return;

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

  async resume(): Promise<void> {
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

    // Resume asserts a FRESH anonymous queue (the previous one auto-deleted on
    // pause), so the retry closure must be rebuilt to target this new queue name
    // — reusing the old closure would dead-letter retries to the now-gone queue.
    const onMessage = this.buildOnMessage(this.getInputMetadata(), queueName);
    this.wrappedOnMessage = onMessage;

    const { consumerTag } = await channel.consume(queueName, onMessage);

    this.consumerTag = consumerTag;

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage,
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

  // Shared inbound handler: deserialize (parse errors → dead letter via DLX)
  // then run the transform stages (failures → retry via native delay-queue/TTL
  // bounded by @Retry, then dead letter to the DLX) — the SAME contract the
  // Rabbit worker queue uses. wrapRabbitConsumer owns ack/nack/DLX.
  // queueName is threaded through so a retry dead-letters to a delay queue keyed
  // by THIS pipeline's own (anonymous, autoDelete) queue — targeting the failing
  // consumer only. The closure captures the queue name by value, so it must be
  // rebuilt whenever the pipeline asserts a fresh queue (start AND resume), never
  // reused across queue names.
  private buildOnMessage(
    inputMetadata: MessageMetadata,
    queueName: string,
  ): (msg: ConsumeMessage | null) => Promise<void> {
    return wrapRabbitConsumer(
      this.buildInboundHost(inputMetadata),
      (message) => this.processStreamMessage(message),
      this.state,
      inputMetadata,
      this.logger,
      queueName,
    );
  }
}
