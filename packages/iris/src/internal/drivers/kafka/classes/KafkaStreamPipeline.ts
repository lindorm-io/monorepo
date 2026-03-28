import { randomUUID } from "@lindorm/random";
import type { KafkaSharedState } from "../types/kafka-types";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic";
import { resolveTopicName } from "../utils/resolve-topic-name";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message";
import { parseKafkaMessage } from "../utils/parse-kafka-message";
import { createKafkaConsumer } from "../utils/create-kafka-consumer";
import { stopKafkaConsumer } from "../utils/stop-kafka-consumer";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase";

export type KafkaStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: KafkaSharedState;
};

export class KafkaStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: KafkaSharedState;
  private consumerTag: string | null = null;
  private groupId: string | null = null;

  public constructor(options: KafkaStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["KafkaStreamPipeline"]),
    });
    this.state = options.state;
  }

  public async start(): Promise<void> {
    if (this.running) {
      const loopExists =
        this.consumerTag != null &&
        this.state.consumers.some((c) => c.consumerTag === this.consumerTag);

      if (loopExists) return;

      this.running = false;
      this.consumerTag = null;
    }

    if (!this.inputClass) {
      throw new IrisDriverError(
        "Stream pipeline requires an input class. Call .from() before .to().",
      );
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot start pipeline: Kafka client is not connected");
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const kafkaTopic = resolveTopicName(this.state.prefix, subscribeTopic);
    this.groupId = `${this.state.prefix}.pipeline.${randomUUID()}`;

    this.running = true;
    this.paused = false;

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      onMessage: async (payload) => {
        const envelope = parseKafkaMessage(payload);
        await this.processInboundData(envelope.payload, envelope.headers, envelope.topic);
      },
    });

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;

    this.logger.debug("Stream pipeline started", {
      consumerTag: this.consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  public async stop(): Promise<void> {
    if (!this.running) return;

    this.paused = false;

    if (this.consumerTag) {
      await stopKafkaConsumer(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.groupId = null;

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

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    await this.doFlushBatchBuffer();

    this.paused = true;

    // Stop the consumer entirely on pause (not just Kafka pause) so that
    // when we resume we can create a new consumer group that starts from
    // the current end of the partition, skipping messages published during pause.
    if (this.consumerTag) {
      await stopKafkaConsumer(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.logger.debug("Stream pipeline paused");
  }

  public async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    if (!this.state.kafka) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const kafkaTopic = resolveTopicName(this.state.prefix, subscribeTopic);

    // Create a new group so messages published during the pause window
    // are skipped — only new messages after resume are processed.
    this.groupId = `${this.state.prefix}.pipeline.${randomUUID()}`;

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      onMessage: async (payload) => {
        const envelope = parseKafkaMessage(payload);
        await this.processInboundData(envelope.payload, envelope.headers, envelope.topic);
      },
    });

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;

    // Brief delay to allow the consumer's fetch loop to initialize after GROUP_JOIN.
    // Without this, messages published immediately after resume() may arrive before
    // the consumer has started polling.
    await new Promise((resolve) => setTimeout(resolve, 200));

    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void> {
    const kafkaTopic = resolveTopicName(this.state.prefix, topic);
    const kafkaMessage = serializeKafkaMessage(envelope);

    if (!this.state.producer) {
      this.logger.warn("Cannot publish stream output: producer is not available");
      return;
    }

    await this.state.producer.send({
      topic: kafkaTopic,
      messages: [kafkaMessage],
      acks: this.state.acks,
    });
  }
}
