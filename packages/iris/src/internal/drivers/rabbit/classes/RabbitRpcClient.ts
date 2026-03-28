import { randomUUID } from "@lindorm/random";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { ConsumeMessage } from "amqplib";
import { IrisSerializationError } from "../../../../errors/IrisSerializationError";
import { IrisTransportError } from "../../../../errors/IrisTransportError";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import type { IMessage } from "../../../../interfaces";
import type { IAmphora } from "@lindorm/amphora";
import { prepareInbound } from "../../../message/utils/prepare-inbound";
import type { RabbitSharedState } from "../types/rabbit-types";
import { DriverRpcClientBase } from "../../../classes/DriverRpcClientBase";
import { buildAmqpHeaders } from "../utils/build-amqp-headers";
import { parseAmqpHeaders } from "../utils/parse-amqp-headers";

const REPLY_TO = "amq.rabbitmq.reply-to";

export type RabbitRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  state: RabbitSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  context?: unknown;
  amphora?: IAmphora;
};

export class RabbitRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private readonly state: RabbitSharedState;
  private replyConsumerTag: string | null = null;
  private returnListenerAttached = false;
  private replyChannel: import("amqplib").ConfirmChannel | null = null;
  private readonly onReturn = (returned: any): void => {
    const cid = returned.properties?.correlationId as string | undefined;
    if (!cid) return;

    const pending = this.pendingRequests.get(cid);
    if (!pending) return;

    const topic = returned.fields?.routingKey ?? "unknown";
    pending.cleanup();
    pending.reject(
      new IrisTransportError(`No RPC handler registered for topic "${topic}"`, {
        debug: { correlationId: cid, topic },
      }),
    );
  };

  public constructor(options: RabbitRpcClientOptions<Req, Res>) {
    super(options, "RabbitRpcClient");
    this.state = options.state;
  }

  public async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);
    const correlationId = randomUUID();

    const publishChannel = this.state.publishChannel;
    if (!publishChannel) {
      throw new IrisDriverError(
        "Cannot send RPC request: publish channel is not available",
      );
    }

    await this.ensureReplyConsumer();

    const { envelope, topic } = await this.prepareRequestEnvelope(message);
    envelope.replyTo = REPLY_TO;
    envelope.correlationId = correlationId;

    const { properties, routingKey } = buildAmqpHeaders(envelope, envelope.headers);

    properties.replyTo = REPLY_TO;
    properties.correlationId = correlationId;
    properties.mandatory = true;

    const { promise } = this.registerPendingRequest(correlationId, topic, timeoutMs);

    publishChannel.publish(
      this.state.exchange,
      routingKey,
      envelope.payload,
      properties,
      (err) => {
        if (err) {
          const pending = this.pendingRequests.get(correlationId);
          if (pending) {
            pending.cleanup();
            pending.reject(
              new IrisTransportError("Failed to publish RPC request", {
                debug: { correlationId, topic },
              }),
            );
          }
        }
      },
    );

    return promise;
  }

  public async close(): Promise<void> {
    this.rejectAllPending();

    if (this.replyConsumerTag && this.state.publishChannel) {
      try {
        await this.state.publishChannel.cancel(this.replyConsumerTag);
      } catch {
        // Channel may already be closed
      }

      const idx = this.state.replyConsumerTags.indexOf(this.replyConsumerTag);
      if (idx !== -1) {
        this.state.replyConsumerTags.splice(idx, 1);
      }
    }
    this.replyConsumerTag = null;

    this.removeReturnListener();

    this.logger.debug("RPC client closed");
  }

  private async ensureReplyConsumer(): Promise<void> {
    const channel = this.state.publishChannel;

    if (this.replyConsumerTag && channel !== this.replyChannel) {
      this.replyConsumerTag = null;
      this.returnListenerAttached = false;
      this.replyChannel = null;
    }

    if (this.replyConsumerTag) return;

    if (!channel) {
      throw new IrisDriverError(
        "Cannot consume RPC replies: publish channel is not available",
      );
    }

    const { consumerTag } = await channel.consume(
      REPLY_TO,
      async (msg: ConsumeMessage | null) => {
        if (!msg) return;

        const cid = msg.properties.correlationId as string | undefined;
        if (!cid) return;

        const pending = this.pendingRequests.get(cid);
        if (!pending) return;

        pending.cleanup();

        const headers = msg.properties.headers ?? {};
        if (headers["x-iris-rpc-error"] === "true") {
          const errorMessage = headers["x-iris-rpc-error-message"] ?? "RPC handler error";
          const errStr = Buffer.isBuffer(errorMessage)
            ? errorMessage.toString()
            : String(errorMessage);
          pending.reject(new Error(errStr));
          return;
        }

        try {
          const parsed = parseAmqpHeaders(msg);
          const data = await prepareInbound(
            parsed.payload,
            parsed.headers,
            this.responseMetadata,
            this.amphora,
          );
          const response = this.responseManager.hydrate(data);
          pending.resolve(response);
        } catch (error) {
          pending.reject(
            error instanceof Error
              ? error
              : new IrisSerializationError("Failed to deserialize RPC response", {
                  debug: { correlationId: cid },
                }),
          );
        }
      },
      { noAck: true },
    );

    this.replyConsumerTag = consumerTag;
    this.replyChannel = channel;
    this.state.replyConsumerTags.push(consumerTag);

    this.ensureReturnListener();
  }

  private ensureReturnListener(): void {
    if (this.returnListenerAttached) return;

    const channel = this.state.publishChannel;
    if (!channel) return;

    channel.on("return", this.onReturn);
    this.returnListenerAttached = true;
  }

  private removeReturnListener(): void {
    if (!this.returnListenerAttached) return;

    const channel = this.state.publishChannel;
    if (channel) {
      channel.removeListener("return", this.onReturn);
    }
    this.returnListenerAttached = false;
  }
}
