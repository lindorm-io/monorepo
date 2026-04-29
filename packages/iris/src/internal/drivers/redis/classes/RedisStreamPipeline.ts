import { randomUUID } from "@lindorm/random";
import type { RedisSharedState, RedisStreamEntry } from "../types/redis-types.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { resolveStreamKey } from "../utils/resolve-stream-key.js";
import { serializeStreamFields } from "../utils/serialize-stream-fields.js";
import { xaddToStream } from "../utils/xadd-to-stream.js";
import { createConsumerLoop } from "../utils/create-consumer-loop.js";
import { stopConsumerLoop } from "../utils/stop-consumer-loop.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";

export type RedisStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: RedisSharedState;
};

export class RedisStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: RedisSharedState;
  private consumerTag: string | null = null;
  private groupName: string | null = null;

  public constructor(options: RedisStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["RedisStreamPipeline"]),
    });
    this.state = options.state;
  }

  public async start(): Promise<void> {
    if (this.running) {
      const loopExists =
        this.consumerTag != null &&
        this.state.consumerLoops.some((l) => l.consumerTag === this.consumerTag);

      if (loopExists) return;

      this.running = false;
      this.consumerTag = null;
    }

    if (!this.inputClass) {
      throw new IrisDriverError(
        "Stream pipeline requires an input class. Call .from() before .to().",
      );
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const streamKey = resolveStreamKey(this.state.prefix, subscribeTopic);
    this.groupName = `${this.state.prefix}.pipeline.${randomUUID()}`;

    this.running = true;
    this.paused = false;

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection!,
      streamKey,
      groupName: this.groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: async (entry) => this.processEntry(entry),
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

  public async stop(): Promise<void> {
    if (!this.running) return;

    this.paused = false;

    if (this.consumerTag) {
      await stopConsumerLoop(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.groupName = null;

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

    if (this.consumerTag) {
      await stopConsumerLoop(this.state, this.consumerTag);
      this.consumerTag = null;
    }

    this.logger.debug("Stream pipeline paused");
  }

  public async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const streamKey = resolveStreamKey(this.state.prefix, subscribeTopic);

    // Create a new group starting at "$" so messages published during
    // the pause window are skipped — only new messages after resume.
    this.groupName = `${this.state.prefix}.pipeline.${randomUUID()}`;

    const loop = await createConsumerLoop({
      publishConnection: this.state.publishConnection!,
      streamKey,
      groupName: this.groupName,
      consumerName: this.state.consumerName,
      blockMs: this.state.blockMs,
      count: this.state.prefetch,
      onEntry: async (entry) => this.processEntry(entry),
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

  private async processEntry(entry: RedisStreamEntry): Promise<void> {
    await this.processInboundData(entry.payload, entry.headers, entry.topic);
  }
}
