import { lindormId } from "@lindorm/random";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type {
  KafkaConsumer,
  KafkaEachMessagePayload,
  KafkaSharedState,
} from "../types/kafka-types.js";
import { createKafkaConsumer } from "../utils/create-kafka-consumer.js";
import { resolveRetryTopicName } from "../utils/resolve-retry-topic.js";
import { resolveTopicName } from "../utils/resolve-topic-name.js";
import {
  ensureRetryTopicAttached,
  releaseRetryConsumer,
} from "../utils/retry-topic-consumer.js";
import { serializeKafkaMessage } from "../utils/serialize-kafka-message.js";
import { stopKafkaConsumer } from "../utils/stop-kafka-consumer.js";
import { wrapKafkaConsumer } from "../utils/wrap-kafka-consumer.js";

export type KafkaStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: KafkaSharedState;
};

export class KafkaStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: KafkaSharedState;
  private consumerTag: string | null = null;
  private groupId: string | null = null;
  private retryTopic: string | null = null;

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

    this.assertInputClass();

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
    this.groupId = `${this.state.prefix}.pipeline.${lindormId({ length: 16 })}`;
    this.retryTopic = resolveRetryTopicName(kafkaTopic, this.groupId);

    this.running = true;
    this.paused = false;

    const consumerRef: { consumer?: KafkaConsumer } = {};
    const onMessage = this.buildOnMessage(inputMetadata, this.retryTopic, () =>
      this.resolveConsumer(consumerRef.consumer),
    );

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      createdTopics: this.state.createdTopics,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      prefetch: this.state.prefetch,
      onMessage,
    });
    consumerRef.consumer = handle.consumer;

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;
    this.registerConsumer(handle.consumerTag, this.groupId, kafkaTopic, onMessage);

    this.logger.debug("Stream pipeline started", {
      consumerTag: this.consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  protected async doStopConsumer(): Promise<void> {
    if (this.consumerTag) {
      this.deregisterConsumer(this.consumerTag);
      await stopKafkaConsumer(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    // Tear down this pipeline's lazily-attached retry-topic consumer (M1), if a
    // retry ever attached one — each start/resume mints a fresh ephemeral group,
    // so an undeleted retry consumer/topic would leak one per pipeline
    // lifecycle. No-op (and no topic to delete) if the pipeline never retried.
    if (this.retryTopic) {
      await releaseRetryConsumer(this.state, this.retryTopic, this.logger);
      this.retryTopic = null;
    }

    this.groupId = null;
  }

  // Stop the consumer entirely on pause (not just Kafka pause) so that when we
  // resume we create a new consumer group starting at the current end of the
  // partition, skipping messages published during pause. Identical to the stop
  // teardown, so delegate. (The base owns the batch-flush + timer-clear.)
  protected async doPauseConsumer(): Promise<void> {
    await this.doStopConsumer();
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
    this.groupId = `${this.state.prefix}.pipeline.${lindormId({ length: 16 })}`;
    this.retryTopic = resolveRetryTopicName(kafkaTopic, this.groupId);

    const consumerRef: { consumer?: KafkaConsumer } = {};
    const onMessage = this.buildOnMessage(inputMetadata, this.retryTopic, () =>
      this.resolveConsumer(consumerRef.consumer),
    );

    const handle = await createKafkaConsumer({
      kafka: this.state.kafka,
      groupId: this.groupId,
      topic: kafkaTopic,
      createdTopics: this.state.createdTopics,
      sessionTimeoutMs: this.state.sessionTimeoutMs,
      logger: this.logger,
      fromBeginning: false,
      abortSignal: this.state.abortController.signal,
      prefetch: this.state.prefetch,
      onMessage,
    });
    consumerRef.consumer = handle.consumer;

    this.state.consumers.push(handle);
    this.consumerTag = handle.consumerTag;
    this.registerConsumer(handle.consumerTag, this.groupId, kafkaTopic, onMessage);

    // No magic sleep: createKafkaConsumer only resolves once the new group has
    // genuinely joined (it awaits the GROUP_JOIN event before returning), so by
    // the time we get here the consumer is joined and fetching. The old
    // hardcoded 200ms guess both under-waited when GROUP_JOIN took longer
    // (dropping messages published in the join window) and needlessly stalled
    // resume() when it was faster.
    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  // Shared inbound handler: deserialize (parse errors → dead letter) then run
  // the transform stages (failures → retry via delay manager / producer re-send
  // bounded by @Retry, then dead letter) — the SAME contract the Kafka worker
  // queue uses. wrapKafkaConsumer owns the offset commit after processing.
  private buildOnMessage(
    inputMetadata: MessageMetadata,
    retryTopic: string,
    getConsumer: () => KafkaConsumer,
  ): (payload: KafkaEachMessagePayload) => Promise<void> {
    const groupId = this.groupId!;
    const onMessageRef: { current?: (p: KafkaEachMessagePayload) => Promise<void> } = {};
    const onMessage = wrapKafkaConsumer(
      this.buildInboundHost(inputMetadata),
      (message) => this.processStreamMessage(message),
      this.state,
      inputMetadata,
      this.logger,
      {
        deadLetterManager: this.deadLetterManager,
        delayManager: this.delayManager,
        consumer: getConsumer,
        retryTopic,
        // Lazily attach the pipeline's per-group retry-topic consumer on the
        // first retry (M1). A dedicated consumer on a fresh group, so a
        // redelivery reaches only this pipeline group — never another pipeline
        // consuming the same input topic.
        ensureRetryReady: () =>
          ensureRetryTopicAttached({
            state: this.state,
            groupId,
            retryTopic,
            onMessage: onMessageRef.current!,
            logger: this.logger,
          }),
      },
    );
    onMessageRef.current = onMessage;
    return onMessage;
  }

  private resolveConsumer(consumer: KafkaConsumer | undefined): KafkaConsumer {
    if (!consumer) {
      throw new IrisDriverError("Kafka stream consumer is not initialised yet", {
        code: "connection_unavailable",
        title: "Connection Unavailable",
        details:
          "The Kafka stream consumer is not available yet, so the offset cannot be committed.",
        data: { driver: "kafka" },
      });
    }
    return consumer;
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
