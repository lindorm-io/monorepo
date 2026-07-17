import { randomId } from "@lindorm/random";
import type { NatsJsMsg, NatsSharedState } from "../types/nats-types.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import type { MessageMetadata } from "../../../message/types/metadata.js";
import { IrisDriverError } from "../../../../errors/IrisDriverError.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { resolveSubject } from "../utils/resolve-subject.js";
import { serializeNatsMessage } from "../utils/serialize-nats-message.js";
import { createNatsConsumer } from "../utils/create-nats-consumer.js";
import { stopNatsConsumer } from "../utils/stop-nats-consumer.js";
import { resolveMaxDeliver } from "../utils/resolve-max-deliver.js";
import { wrapNatsConsumer } from "../utils/wrap-nats-consumer.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";

export type NatsStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  state: NatsSharedState;
};

export class NatsStreamPipeline extends DriverStreamPipelineBase {
  private readonly state: NatsSharedState;
  private consumerTag: string | null = null;
  private consumerName: string | null = null;

  constructor(options: NatsStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["NatsStreamPipeline"]),
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

    if (!this.state.js || !this.state.jsm) {
      throw new IrisDriverError(
        "Cannot start stream pipeline: connection is not available",
        {
          code: "connection_unavailable",
          title: "Connection Unavailable",
          details:
            "The NATS JetStream connection is not established, so the stream pipeline cannot start.",
          data: { driver: "nats" },
        },
      );
    }

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const subject = resolveSubject(this.state.prefix, subscribeTopic);
    const consumerName =
      `${this.state.prefix}_pipeline_${randomId({ length: 16 })}`.replace(
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
      onMessage: this.buildOnMessage(inputMetadata),
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
      maxDeliver: resolveMaxDeliver(inputMetadata),
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

  async stop(): Promise<void> {
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

  async pause(): Promise<void> {
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

  async resume(): Promise<void> {
    if (!this.paused) return;
    this.paused = false;

    if (!this.running || !this.inputClass) return;

    if (!this.state.js || !this.state.jsm) return;

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);
    const subject = resolveSubject(this.state.prefix, subscribeTopic);

    // Create a new consumer so messages published during the pause window are skipped
    const consumerName =
      `${this.state.prefix}_pipeline_${randomId({ length: 16 })}`.replace(
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
      onMessage: this.buildOnMessage(inputMetadata),
      logger: this.logger,
      ensuredConsumers: this.state.ensuredConsumers,
      deliverPolicy: "new",
      maxDeliver: resolveMaxDeliver(inputMetadata),
    });
    this.state.consumerLoops.push(loop);

    this.consumerTag = loop.consumerTag;
    this.consumerName = loop.consumerName;

    await loop.ready;

    this.logger.debug("Stream pipeline resumed", { consumerTag: this.consumerTag });
  }

  // Shared inbound handler: deserialize (parse errors → dead letter via term)
  // then run the transform stages (failures → native nak retry bounded by
  // maxDeliver / @Retry, then term to dead letter) — the SAME contract the
  // NATS worker queue uses. wrapNatsConsumer owns ack/nak/term.
  private buildOnMessage(
    inputMetadata: MessageMetadata,
  ): (msg: NatsJsMsg) => Promise<void> {
    return wrapNatsConsumer(
      this.buildInboundHost(inputMetadata),
      (message) => this.processStreamMessage(message),
      this.state,
      inputMetadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );
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
