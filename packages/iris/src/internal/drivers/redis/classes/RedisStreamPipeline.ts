import { lindormId } from "@lindorm/random";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseSettings,
} from "../../../classes/DriverStreamPipelineBase.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type {
  RedisConsumeOutcome,
  RedisSharedState,
  RedisStreamEntry,
} from "../types/redis-types.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { serializeStreamFields } from "../utils/serialize-stream-fields.js";
import { stopConsumerLoop } from "../utils/stop-consumer-loop.js";
import { wrapRedisConsumer } from "../utils/wrap-redis-consumer.js";
import { xaddToStream } from "../utils/xadd-to-stream.js";

export type RedisStreamPipelineSettings = DriverStreamPipelineBaseSettings & {
  state: RedisSharedState;
};

export class RedisStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: RedisSharedState;
  private consumerTag: string | null = null;
  private groupName: string | null = null;

  constructor(options: RedisStreamPipelineSettings) {
    super({
      ...options,
      logger: options.logger.child(["RedisStreamPipeline"]),
    });
    this.state = options.state;
  }

  async start(): Promise<void> {
    if (this.running) {
      const loopExists =
        this.consumerTag != null &&
        this.state.consumerLoops.some((l) => l.consumerTag === this.consumerTag);

      if (loopExists) return;

      this.running = false;
      this.consumerTag = null;
    }

    this.assertInputClass();

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const streamKey = resolveStreamKey(this.state.prefix, subscribeTopic);
    this.groupName = `${this.state.prefix}.pipeline.${lindormId({ length: 16 })}`;

    this.running = true;
    this.paused = false;

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection!,
      streamKey,
      groupName: this.groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: this.buildOnEntry(inputMetadata),
      logger: this.logger,
      createdGroups: this.state.createdGroups,
    });
    this.state.consumerLoops.push(loop);

    this.consumerTag = loop.consumerTag;

    this.logger.debug("Stream pipeline started", {
      consumerTag: this.consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  protected async doStopConsumer(): Promise<void> {
    if (this.consumerTag) {
      await stopConsumerLoop(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.groupName = null;
  }

  // Pause tears the consumer group down exactly as stop does (a fresh group at
  // "$" is created on resume), so delegate. The base owns the batch-flush +
  // timer-clear.
  protected async doPauseConsumer(): Promise<void> {
    await this.doStopConsumer();
  }

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const streamKey = resolveStreamKey(this.state.prefix, subscribeTopic);

    // Create a new group starting at "$" so messages published during
    // the pause window are skipped — only new messages after resume.
    this.groupName = `${this.state.prefix}.pipeline.${lindormId({ length: 16 })}`;

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection!,
      streamKey,
      groupName: this.groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: this.buildOnEntry(inputMetadata),
      logger: this.logger,
      createdGroups: this.state.createdGroups,
    });
    this.state.consumerLoops.push(loop);

    this.consumerTag = loop.consumerTag;

    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void> {
    const streamKey = resolveStreamKey(this.state.prefix, topic);
    const fields = serializeStreamFields(envelope);

    const conn = this.state.publishConnection;
    if (!conn) {
      this.logger.warn("Cannot publish stream output: connection is not available");
      return;
    }

    await xaddToStream(conn, streamKey, fields, this.state.maxStreamLength);
  }

  // Shared inbound handler: deserialize (parse errors → dead letter) then run
  // the transform stages (failures → retry via delay manager / re-xadd bounded
  // by @Retry, then dead letter) — the SAME contract the Redis worker queue uses.
  private buildOnEntry(
    inputMetadata: MessageMetadata,
  ): (entry: RedisStreamEntry) => Promise<RedisConsumeOutcome> {
    return wrapRedisConsumer(
      this.buildInboundHost(inputMetadata),
      (message) => this.processStreamMessage(message),
      this.state,
      inputMetadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );
  }
}
