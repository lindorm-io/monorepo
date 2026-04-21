import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { ConsumeMessage } from "amqplib";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import { DriverRpcServerBase } from "../../../classes/DriverRpcServerBase.js";
import { buildAmqpHeaders } from "../utils/build-amqp-headers.js";
import { parseAmqpHeaders } from "../utils/parse-amqp-headers.js";
import { resolveQueueName } from "../utils/resolve-queue-name.js";
import { sanitizeRoutingKey } from "../utils/sanitize-routing-key.js";

export type RabbitRpcServerOptions<Req extends IMessage, Res extends IMessage> = {
  state: RabbitSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

export class RabbitRpcServer<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcServerBase<Req, Res> {
  private readonly state: RabbitSharedState;
  private readonly ownedConsumerTags: Map<string, string> = new Map();

  public constructor(options: RabbitRpcServerOptions<Req, Res>) {
    super(options, "RabbitRpcServer");
    this.state = options.state;
  }

  protected async doServe(
    queue: string,
    topic: string,
    handler: (request: Req) => Promise<Res>,
  ): Promise<void> {
    const channel = this.state.consumeChannel;
    if (!channel) {
      throw new IrisDriverError("Cannot serve RPC: consume channel is not available");
    }

    const queueName = resolveQueueName({
      exchange: this.state.exchange,
      topic,
      queue,
      type: "rpc",
    })!;

    if (!this.state.assertedQueues.has(queueName)) {
      await channel.assertQueue(queueName, { durable: true });
      await channel.bindQueue(queueName, this.state.exchange, sanitizeRoutingKey(topic));
      this.state.assertedQueues.add(queueName);
    }

    const onMessage = async (msg: ConsumeMessage | null): Promise<void> => {
      if (!msg) return;

      try {
        const parsed = parseAmqpHeaders(msg);
        const { responseEnvelope } = await this.processRequest(
          handler,
          parsed.payload,
          parsed.headers,
          queue,
        );

        const { properties } = buildAmqpHeaders(
          responseEnvelope,
          responseEnvelope.headers,
        );
        properties.correlationId = msg.properties.correlationId;

        const publishChannel = this.state.publishChannel;
        if (publishChannel && msg.properties.replyTo) {
          publishChannel.publish(
            "",
            msg.properties.replyTo,
            responseEnvelope.payload,
            properties,
          );
        }

        channel.ack(msg);
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        this.logger.error("RPC handler error", {
          error: err.message,
          queue: queueName,
        });

        const publishChannel = this.state.publishChannel;
        if (publishChannel && msg.properties.replyTo) {
          const errorHeaders: Record<string, string> = {
            "x-iris-rpc-error": "true",
            "x-iris-rpc-error-message": err.message,
          };
          publishChannel.publish(
            "",
            msg.properties.replyTo,
            Buffer.from(JSON.stringify({ error: err.message })),
            {
              correlationId: msg.properties.correlationId,
              headers: errorHeaders,
            },
          );
        }

        channel.ack(msg);
      }
    };

    const { consumerTag } = await channel.consume(queueName, onMessage);

    this.ownedConsumerTags.set(queue, consumerTag);

    this.state.consumerRegistrations.push({
      queue: queueName,
      consumerTag,
      onMessage,
      routingKey: sanitizeRoutingKey(topic),
      exchange: this.state.exchange,
      queueOptions: { durable: true },
    });
  }

  public async unserve(options?: { queue?: string }): Promise<void> {
    const queue = options?.queue ?? this.getDefaultQueue();
    const consumerTag = this.ownedConsumerTags.get(queue);

    if (consumerTag) {
      const channel = this.state.consumeChannel;
      if (channel) {
        await channel.cancel(consumerTag);
      }

      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== consumerTag,
      );
      this.ownedConsumerTags.delete(queue);
    }
    this.registeredQueues.delete(queue);

    this.logger.debug("RPC handler unregistered", { queue });
  }

  public async unserveAll(): Promise<void> {
    const channel = this.state.consumeChannel;

    for (const [queue, consumerTag] of this.ownedConsumerTags) {
      if (channel) {
        await channel.cancel(consumerTag);
      }
      this.state.consumerRegistrations = this.state.consumerRegistrations.filter(
        (r) => r.consumerTag !== consumerTag,
      );
      this.ownedConsumerTags.delete(queue);
    }

    this.registeredQueues.clear();

    this.logger.debug("All RPC handlers unregistered");
  }
}
