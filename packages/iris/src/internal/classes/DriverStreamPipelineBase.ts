import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisStreamPipeline, IMessage } from "../../interfaces/index.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { PipelineStage } from "../types/pipeline-stage.js";
import type { IAmphora } from "@lindorm/amphora";
import { applyStage } from "../message/utils/apply-stage.js";
import { MessageManager } from "../message/classes/MessageManager.js";
import { getMessageMetadata } from "../message/metadata/get-message-metadata.js";
import { prepareOutbound } from "../message/utils/prepare-outbound.js";
import { prepareInbound } from "../message/utils/prepare-inbound.js";
import { resolveDefaultTopic } from "../message/utils/resolve-default-topic.js";
import { buildEnvelope } from "../utils/build-envelope.js";

export type DriverStreamPipelineBaseOptions = {
  logger: ILogger;
  stages: Array<PipelineStage>;
  inputClass?: Constructor<IMessage>;
  inputTopic?: string;
  outputClass: Constructor<IMessage>;
  outputTopic?: string;
  meta?: IrisHookMeta;
  amphora?: unknown;
};

export abstract class DriverStreamPipelineBase implements IIrisStreamPipeline {
  protected readonly logger: ILogger;
  protected readonly stages: Array<PipelineStage>;
  protected readonly inputClass: Constructor<IMessage> | undefined;
  protected readonly inputTopic: string | undefined;
  protected readonly outputClass: Constructor<IMessage>;
  protected readonly outputTopic: string | undefined;
  protected readonly meta: IrisHookMeta | undefined;
  protected readonly amphora: IAmphora | undefined;
  protected readonly outputManager: MessageManager<IMessage>;
  protected running = false;
  protected paused = false;
  protected batchBuffer: Array<any> = [];
  protected batchTimer: ReturnType<typeof setTimeout> | null = null;
  protected _processingQueue: Promise<void> = Promise.resolve();

  public constructor(options: DriverStreamPipelineBaseOptions) {
    this.logger = options.logger;
    this.stages = options.stages;
    this.inputClass = options.inputClass;
    this.inputTopic = options.inputTopic;
    this.outputClass = options.outputClass;
    this.outputTopic = options.outputTopic;
    this.meta = options.meta;
    this.amphora = options.amphora as IAmphora | undefined;
    this.outputManager = new MessageManager({
      target: this.outputClass,
      meta: this.meta,
      logger: options.logger,
    });
  }

  public abstract start(): Promise<void>;
  public abstract stop(): Promise<void>;
  public abstract pause(): Promise<void>;
  public abstract resume(): Promise<void>;

  public isRunning(): boolean {
    return this.running && !this.paused;
  }

  protected abstract doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void>;

  protected processInboundData(
    payload: Buffer,
    headers: Record<string, string>,
    sourceTopic: string,
  ): Promise<void> {
    if (!this.running || this.paused) return Promise.resolve();

    this._processingQueue = this._processingQueue.then(() =>
      this._doProcessInboundData(payload, headers, sourceTopic),
    );

    return this._processingQueue;
  }

  private async _doProcessInboundData(
    payload: Buffer,
    headers: Record<string, string>,
    sourceTopic: string,
  ): Promise<void> {
    if (!this.running || this.paused) return;

    if (!this.inputClass) {
      this.logger.error(
        "Stream pipeline has no input class — call .from() before starting",
      );
      return;
    }

    try {
      const inputMetadata = getMessageMetadata(this.inputClass);
      const inboundData = await prepareInbound(
        payload,
        headers,
        inputMetadata,
        this.amphora,
      );

      let items: Array<any> = [inboundData];

      for (const stage of this.stages) {
        if (stage.type === "batch") {
          this.batchBuffer.push(...items);

          if (this.batchBuffer.length >= stage.size) {
            const batch = this.batchBuffer.splice(0, stage.size);
            items = [batch];
          } else {
            this.resetBatchTimer(stage);
            return;
          }
        } else {
          items = applyStage(stage, items);
        }

        if (items.length === 0) return;
      }

      for (const item of items) {
        await this.publishOutput(item);
      }
    } catch (error) {
      this.logger.error("Stream pipeline processing error", {
        error,
        topic: sourceTopic,
      });
    }
  }

  protected async publishOutput(data: any): Promise<void> {
    const metadata = this.outputManager.metadata;
    const message = this.outputManager.hydrate(data as Record<string, unknown>);
    this.outputManager.validate(message);
    const topic = this.outputTopic ?? resolveDefaultTopic(this.outputManager.metadata);
    const outbound = await prepareOutbound(message, metadata, this.amphora);
    const envelope = buildEnvelope(outbound, topic, metadata);

    await this.doPublishEnvelope(envelope, topic);
  }

  protected resetBatchTimer(stage: { size: number; timeout?: number }): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }

    if (stage.timeout && stage.timeout > 0) {
      this.batchTimer = setTimeout(() => {
        this.batchTimer = null;
        this._processingQueue = this._processingQueue
          .then(() => this.doFlushBatchBuffer())
          .catch((error) => {
            this.logger.error("Stream pipeline batch flush failed", {
              error: error instanceof Error ? error.message : String(error),
            });
          });
      }, stage.timeout);
      this.batchTimer.unref();
    }
  }

  protected flushBatchBuffer(): Promise<void> {
    if (!this.running || this.paused) return Promise.resolve();

    this._processingQueue = this._processingQueue.then(() => this.doFlushBatchBuffer());

    return this._processingQueue;
  }

  protected async doFlushBatchBuffer(): Promise<void> {
    if (!this.running) return;
    if (this.batchBuffer.length === 0) return;

    const batch = this.batchBuffer.splice(0);

    try {
      const batchIdx = this.stages.findIndex((s) => s.type === "batch");

      if (batchIdx === -1) return;

      const postBatchStages = this.stages.slice(batchIdx + 1);

      let items: Array<any> = [batch];

      for (const stage of postBatchStages) {
        items = applyStage(stage as Exclude<PipelineStage, { type: "batch" }>, items);
        if (items.length === 0) return;
      }

      for (const item of items) {
        await this.publishOutput(item);
      }
    } catch (error) {
      this.logger.error("Stream pipeline flush error", {
        error,
        batchSize: batch.length,
      });
    }
  }
}
