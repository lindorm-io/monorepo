import { randomId } from "@lindorm/random";
import type { KafkaEachMessagePayload, KafkaSharedState } from "../types/kafka-types.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import { parseKafkaMessage } from "../utils/parse-kafka-message.js";
import { createKafkaConsumer } from "../utils/create-kafka-consumer.js";
import { stopKafkaConsumer } from "../utils/stop-kafka-consumer.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";

export type KafkaStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: KafkaSharedState;
};

export class KafkaStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: KafkaSharedState;
  private consumerTag: string | null = null;
  private groupId: string | null = null;

  constructor(options: KafkaStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["KafkaStreamPipeline"]),
    });
    this.state = options.state;
  }

  async start(): Promise<void> {
    if (this.running) {
      const loopExists =
        this.consumerTag != null &&
        this.state.consumers.some((c) => c.consumerTag === this.consumerTag);

      if (loopExists) return;

      // The recorded consumer is gone (e.g. crashed) — drop its stale
      // registration before we re-create below so it isn't replayed twice.
      if (this.consumerTag) this.deregisterConsumer(this.consumerTag);
      this.running = false;
      this.consumerTag = null;
    }

    if (!this.inputClass) {
      throw new IrisDriverError(
        "Stream pipeline requires an input class. Call .from() before .to().",
        {
          code: "pipeline_input_class_required",
          title: "Pipeline Input Class Required",
          details:
            "The stream pipeline was started without an input class; call .from() before .to().",
        },
      );
    }

    if (!this.state.kafka) {
      throw new IrisDriverError("Cannot start pipeline: Kafka client is not connected", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Kafka client is not connected, so the stream pipeline cannot start.",
        data: { driver: "kafka" },
      });
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const kafkaTopic = resolveTopicName(this.state.prefix, subscribeTopic);
    this.groupId = `${this.state.prefix}.pipeline.${randomId({ length: 16 })}`;

    this.running = true;
    this.paused = false;

    const onMessage = this.createInboundHandler();

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      onMessage,
    });

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;
    this.registerConsumer(handle.consumerTag, this.groupId, kafkaTopic, onMessage);

    this.logger.debug("Stream pipeline started", {
      consumerTag: this.consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  async stop(): Promise<void> {
    if (!this.running) return;

    this.paused = false;

    if (this.consumerTag) {
      this.deregisterConsumer(this.consumerTag);
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

  async pause(): Promise<void> {
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
      this.deregisterConsumer(this.consumerTag);
      await stopKafkaConsumer(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.logger.debug("Stream pipeline paused");
  }

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    if (!this.state.kafka) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const kafkaTopic = resolveTopicName(this.state.prefix, subscribeTopic);

    // Create a new group so messages published during the pause window
    // are skipped — only new messages after resume are processed.
    this.groupId = `${this.state.prefix}.pipeline.${randomId({ length: 16 })}`;

    const onMessage = this.createInboundHandler();

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      onMessage,
    });

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;
    this.registerConsumer(handle.consumerTag, this.groupId, kafkaTopic, onMessage);

    // Brief delay to allow the consumer's fetch loop to initialize after GROUP_JOIN.
    // Without this, messages published immediately after resume() may arrive before
    // the consumer has started polling.
    await new Promise((resolve) => setTimeout(resolve, 200));

    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  private createInboundHandler(): (payload: KafkaEachMessagePayload) => Promise<void> {
    return async (payload: KafkaEachMessagePayload): Promise<void> => {
      const envelope = parseKafkaMessage(payload);
      await this.processInboundData(envelope.payload, envelope.headers, envelope.topic);
    };
  }

  // Register the dedicated pipeline consumer in the driver's registry so it is
  // re-established on reconnect. Marked pooled:false — the pipeline owns a
  // dedicated (non-pooled) consumer, and the tag is reused on rebuild so this
  // instance's cached consumerTag stays valid.
  private registerConsumer(
    consumerTag: string,
    groupId: string,
    topic: string,
    onMessage: (payload: KafkaEachMessagePayload) => Promise<void>,
  ): void {
    this.state.consumerRegistrations.push({
      consumerTag,
      groupId,
      topic,
      onMessage,
      pooled: false,
      fromBeginning: false,
    });
  }

  private deregisterConsumer(consumerTag: string): void {
    const idx = this.state.consumerRegistrations.findIndex(
      (r) => r.consumerTag === consumerTag,
    );
    if (idx !== -1) this.state.consumerRegistrations.splice(idx, 1);
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
