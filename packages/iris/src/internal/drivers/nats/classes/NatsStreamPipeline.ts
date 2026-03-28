import { randomUUID } from "@lindorm/random";
import type { NatsSharedState } from "../types/nats-types";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic";
import { resolveSubject } from "../utils/resolve-subject";
import { serializeNatsMessage } from "../utils/serialize-nats-message";
import { parseNatsMessage } from "../utils/parse-nats-message";
import { createNatsConsumer } from "../utils/create-nats-consumer";
import { stopNatsConsumer } from "../utils/stop-nats-consumer";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase";

export type NatsStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: NatsSharedState;
};

export class NatsStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: NatsSharedState;
  private consumerTag: string | null = null;
  private consumerName: string | null = null;

  public constructor(options: NatsStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["NatsStreamPipeline"]),
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

    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError(
        "Cannot start stream pipeline: connection is not available",
      );
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const subject = resolveSubject(this.state.prefix, subscribeTopic);
    const consumerName = `${this.state.prefix}_pipeline_${randomUUID()}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    this.running = true;
    this.paused = false;

    const loop = await createNatsConsumer({
      js: this.state.js,
      jsm: this.state.jsm,
      streamName: this.state.streamName,
      consumerName,
      subject,
      prefetch: this.state.prefetch,
      onMessage: async (msg) => {
        const envelope = parseNatsMessage(msg.data);
        await this.processInboundData(envelope.payload, envelope.headers, envelope.topic);
        msg.ack();
      },
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
    });
    this.state.consumerLoops.push(loop);

    this.consumerTag = loop.consumerTag;
    this.consumerName = loop.consumerName;

    await loop.ready;

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
      await stopNatsConsumer(this.state, this.consumerTag);

      if (this.consumerName && this.state.jsm) {
        try {
          await this.state.jsm.consumers.delete(this.state.streamName, this.consumerName);
        } catch {
          // ignore
        }
        this.state.ensuredConsumers.delete(this.consumerName);
      }

      this.consumerTag = null;
      this.consumerName = null;
    }

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
      await stopNatsConsumer(this.state, this.consumerTag);

      if (this.consumerName && this.state.jsm) {
        try {
          await this.state.jsm.consumers.delete(this.state.streamName, this.consumerName);
        } catch {
          // ignore
        }
        this.state.ensuredConsumers.delete(this.consumerName);
      }

      this.consumerTag = null;
      this.consumerName = null;
    }

    this.logger.debug("Stream pipeline paused");
  }

  public async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    if (!this.state.js || !this.state.jsm) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const subject = resolveSubject(this.state.prefix, subscribeTopic);

    // Create a new consumer so messages published during the pause window are skipped
    const consumerName = `${this.state.prefix}_pipeline_${randomUUID()}`.replace(
      /[^a-zA-Z0-9_-]/g,
      "_",
    );

    const loop = await createNatsConsumer({
      js: this.state.js,
      jsm: this.state.jsm,
      streamName: this.state.streamName,
      consumerName,
      subject,
      prefetch: this.state.prefetch,
      onMessage: async (msg) => {
        const envelope = parseNatsMessage(msg.data);
        await this.processInboundData(envelope.payload, envelope.headers, envelope.topic);
        msg.ack();
      },
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
    });
    this.state.consumerLoops.push(loop);

    this.consumerTag = loop.consumerTag;
    this.consumerName = loop.consumerName;

    await loop.ready;

    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void> {
    const js = this.state.js;
    if (!js || !this.state.headersInit) {
      this.logger.warn("Cannot publish stream output: connection is not available");
      return;
    }

    const subject = resolveSubject(this.state.prefix, topic);
    const { data } = serializeNatsMessage(envelope, this.state.headersInit);

    await js.publish(subject, data);
  }
}
