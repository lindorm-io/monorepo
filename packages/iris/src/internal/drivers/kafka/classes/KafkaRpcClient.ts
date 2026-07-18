import type { ILogger } from "@lindorm/logger";
import { lindormId } from "@lindorm/random";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import { SharedReplyConsumerRpcClientBase } from "../../../classes/SharedReplyConsumerRpcClientBase.js";
import type { MessageEncryptionContext } from "../../../message/types/encryption-context.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { createKafkaConsumer } from "../utils/create-kafka-consumer.js";
import { deleteKafkaTopicFromState } from "../utils/delete-kafka-topic.js";
import { ensureKafkaTopicFromState } from "../utils/ensure-kafka-topic.js";
import { parseKafkaMessage } from "../utils/parse-kafka-message.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import { stopKafkaConsumer } from "../utils/stop-kafka-consumer.js";

export type KafkaRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  state: KafkaSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  encryption?: MessageEncryptionContext;
};

export class KafkaRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends SharedReplyConsumerRpcClientBase<Req, Res> {
  private readonly state: KafkaSharedState;
  private readonly replyTopic: string;
  private replyConsumerTag: string | null = null;

  constructor(options: KafkaRpcClientOptions<Req, Res>) {
    super(options, "KafkaRpcClient");
    this.state = options.state;
    this.replyTopic = `${this.state.prefix}.rpc.reply.${lindormId({ length: 16 })}`;
  }

  async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);
    const correlationId = lindormId({ namespace: "cor", length: 16 });

    if (!this.state.producer) {
      throw new IrisDriverError("Cannot send RPC request: producer is not connected", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Kafka producer is not connected, so the RPC request cannot be sent.",
        data: { driver: "kafka" },
      });
    }

    await this.ensureReplyConsumer();

    const { envelope, topic } = await this.prepareRequestEnvelope(message);
    envelope.replyTo = this.replyTopic;
    envelope.correlationId = correlationId;

    const { promise } = this.registerPendingRequest(correlationId, topic, timeoutMs);

    const kafkaTopic = resolveTopicName(this.state.prefix, `rpc.${topic}`);
    const kafkaMessage = serializeKafkaMessage(envelope);

    await this.state.producer.send({
      topic: kafkaTopic,
      messages: [kafkaMessage],
      acks: this.state.acks,
    });

    return promise;
  }

  async close(): Promise<void> {
    this.rejectAllPending();

    if (this.replyConsumerTag) {
      await stopKafkaConsumer(this.state, this.replyConsumerTag);
      this.replyConsumerTag = null;
    }

    // Best-effort teardown of the client's unique reply topic so short-lived
    // clients don't leak orphan topics on the broker (never throws out of close).
    await deleteKafkaTopicFromState(this.state, this.replyTopic, this.logger);

    this.resetReplyConsumer();
    this.logger.debug("RPC client closed");
  }

  protected async createReplyConsumer(): Promise<void> {
    if (!this.state.kafka) {
      throw new IrisDriverError(
        "Cannot create reply consumer: Kafka client is not connected",
        {
          code: "connection_unavailable",
          title: "Connection Unavailable",
          details:
            "The Kafka client is not connected, so the RPC reply consumer cannot be created.",
          data: { driver: "kafka" },
        },
      );
    }

    const replyGroupId = `${this.state.prefix}.rpc.reply.${lindormId({ length: 16 })}`;

    // Pre-create the dynamic reply topic before subscribing
    await ensureKafkaTopicFromState(this.state, this.replyTopic, this.logger);

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: replyGroupId,
      topic: this.replyTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      abortSignal: this.state.abortController.signal,
      prefetch: this.state.prefetch,
      onMessage: async (payload) => {
        const envelope = parseKafkaMessage(payload);
        const cid = envelope.correlationId;
        if (!cid) return;

        await this.handleReplyPayload(cid, envelope.payload, envelope.headers);
      },
    });

    this.state.consumers.push(handle);
    this.replyConsumerTag = handle.consumerTag;
  }
}
