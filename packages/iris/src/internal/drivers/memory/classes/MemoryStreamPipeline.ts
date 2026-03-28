import { randomUUID } from "@lindorm/random";
import type { MemorySharedState } from "../types/memory-store";
import type { IrisEnvelope } from "../../../types/iris-envelope";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata";
import { prepareOutbound } from "../../../message/utils/prepare-outbound";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic";
import { buildEnvelope } from "../../../utils/build-envelope";
import { dispatchToSubscribers } from "../utils/dispatch-to-subscribers";
import { dispatchToConsumers } from "../utils/dispatch-to-consumers";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase";

export type MemoryStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  store: MemorySharedState;
};

export class MemoryStreamPipeline extends DriverStreamPipelineBase {
  private readonly store: MemorySharedState;
  private consumerTag: string | null = null;

  public constructor(options: MemoryStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["MemoryStreamPipeline"]),
    });
    this.store = options.store;
  }

  public async start(): Promise<void> {
    if (this.running) {
      const subscriptionExists =
        this.consumerTag != null &&
        this.store.subscriptions.some((s) => s.consumerTag === this.consumerTag);

      if (subscriptionExists) return;

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

    this.running = true;
    this.paused = false;
    this.consumerTag = randomUUID();

    this.store.subscriptions.push({
      topic: subscribeTopic,
      queue: null,
      callback: async (envelope) =>
        this.processInboundData(envelope.payload, envelope.headers, envelope.topic),
      consumerTag: this.consumerTag,
    });

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
      this.store.subscriptions = this.store.subscriptions.filter(
        (s) => s.consumerTag !== this.consumerTag,
      );
      this.consumerTag = null;
    }

    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.store.timers.delete(this.batchTimer);
      this.batchTimer = null;
    }

    await this.flushBatchBuffer();

    this.running = false;

    this.logger.debug("Stream pipeline stopped");
  }

  public async pause(): Promise<void> {
    this.paused = true;
    this.logger.debug("Stream pipeline paused");
  }

  public async resume(): Promise<void> {
    this.paused = false;
    this.logger.debug("Stream pipeline resumed");
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    _topic: string,
  ): Promise<void> {
    await dispatchToSubscribers(this.store, envelope);
    await dispatchToConsumers(this.store, envelope);
  }

  protected override async publishOutput(data: any): Promise<void> {
    const metadata = this.outputManager.metadata;
    const message = this.outputManager.hydrate(data as Record<string, unknown>);
    this.outputManager.validate(message);
    const topic = this.outputTopic ?? resolveDefaultTopic(this.outputManager.metadata);
    const outbound = await prepareOutbound(message, metadata, this.amphora);
    const outputEnvelope = buildEnvelope(outbound, topic, metadata);

    await dispatchToSubscribers(this.store, outputEnvelope);
    await dispatchToConsumers(this.store, outputEnvelope);
  }

  protected override resetBatchTimer(stage: { size: number; timeout?: number }): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.store.timers.delete(this.batchTimer);
      this.batchTimer = null;
    }

    if (stage.timeout && stage.timeout > 0) {
      this.batchTimer = setTimeout(() => {
        if (this.batchTimer) {
          this.store.timers.delete(this.batchTimer);
        }
        this.batchTimer = null;
        this._processingQueue = this._processingQueue
          .then(() => this.doFlushBatchBuffer())
          .catch((error) => {
            this.logger.error("Stream pipeline batch flush failed", { error });
          });
      }, stage.timeout);
      this.batchTimer.unref();

      this.store.timers.add(this.batchTimer);
    }
  }
}
