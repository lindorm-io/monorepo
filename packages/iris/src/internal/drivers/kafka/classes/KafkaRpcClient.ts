import { randomUUID } from "@lindorm/random";
import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import type { IMessage } from "../../../../interfaces/index.js";
import type { IrisHookMeta } from "../../../../types/index.js";
import type { IAmphora } from "@lindorm/amphora";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { DriverRpcClientBase } from "../../../classes/DriverRpcClientBase.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import { parseKafkaMessage } from "../utils/parse-kafka-message.js";
import { createKafkaConsumer } from "../utils/create-kafka-consumer.js";
import { ensureKafkaTopicFromState } from "../utils/ensure-kafka-topic.js";
import { stopKafkaConsumer } from "../utils/stop-kafka-consumer.js";

export type KafkaRpcClientOptions<Req extends IMessage, Res extends IMessage> = {
  state: KafkaSharedState;
  logger: ILogger;
  requestTarget: Constructor<Req>;
  responseTarget: Constructor<Res>;
  meta?: IrisHookMeta;
  amphora?: IAmphora;
};

export class KafkaRpcClient<
  Req extends IMessage,
  Res extends IMessage,
> extends DriverRpcClientBase<Req, Res> {
  private readonly state: KafkaSharedState;
  private readonly replyTopic: string;
  private replyConsumerPromise: Promise<void> | null = null;
  private replyConsumerTag: string | null = null;

  public constructor(options: KafkaRpcClientOptions<Req, Res>) {
    super(options, "KafkaRpcClient");
    this.state = options.state;
    this.replyTopic = `${this.state.prefix}.rpc.reply.${randomUUID()}`;
  }

  public async request(message: Req, options?: { timeout?: number }): Promise<Res> {
    const timeoutMs = this.getDefaultTimeout(options);
    const correlationId = randomUUID();

    if (!this.state.producer) {
      throw new IrisDriverError("Cannot send RPC request: producer is not connected");
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

  public async close(): Promise<void> {
    this.rejectAllPending();

    if (this.replyConsumerTag) {
      await stopKafkaConsumer(this.state, this.replyConsumerTag);
      this.replyConsumerTag = null;
    }

    this.replyConsumerPromise = null;
    this.logger.debug("RPC client closed");
  }

  private async ensureReplyConsumer(): Promise<void> {
    this.replyConsumerPromise ??= this.doEnsureReplyConsumer().catch((err) => {
      this.replyConsumerPromise = null;
      throw err;
    });
    await this.replyConsumerPromise;
  }

  private async doEnsureReplyConsumer(): Promise<void> {
    if (!this.state.kafka) {
      throw new IrisDriverError(
        "Cannot create reply consumer: Kafka client is not connected",
      );
    }

    const replyGroupId = `${this.state.prefix}.rpc.reply.${randomUUID()}`;

    // Pre-create the dynamic reply topic before subscribing
    await ensureKafkaTopicFromState(this.state, this.replyTopic, this.logger);

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: replyGroupId,
      topic: this.replyTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      abortSignal: this.state.abortController.signal,
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
