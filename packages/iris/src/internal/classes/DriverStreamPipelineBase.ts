import type { ILogger } from "@lindorm/logger";
import type { Constructor } from "@lindorm/types";
import type { IIrisStreamPipeline, IMessage } from "../../interfaces/index.js";
import { IrisDriverError } from "../../errors/IrisDriverError.js";
import type { IrisHookMeta } from "../../types/iris-hook-meta.js";
import type { DeadLetterManager } from "../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../delay/DelayManager.js";
import type { IrisEnvelope } from "../types/iris-envelope.js";
import type { PipelineStage } from "../types/pipeline-stage.js";
import type { MessageEncryptionContext } from "../message/types/encryption-context.js";
import type { MessageMetadata } from "../message/types/metadata.js";
import type { ConsumerCallbackHost } from "../utils/consume-message-core.js";
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
  encryption?: MessageEncryptionContext;
  deadLetterManager?: DeadLetterManager;
  delayManager?: DelayManager;
};

export abstract class DriverStreamPipelineBase implements IIrisStreamPipeline {
  protected readonly logger: ILogger;
  protected readonly stages: Array<PipelineStage>;
  protected readonly inputClass: Constructor<IMessage> | undefined;
  protected readonly inputTopic: string | undefined;
  protected readonly outputClass: Constructor<IMessage>;
  protected readonly outputTopic: string | undefined;
  protected readonly meta: IrisHookMeta | undefined;
  protected readonly encryption: MessageEncryptionContext | undefined;
  protected readonly deadLetterManager: DeadLetterManager | undefined;
  protected readonly delayManager: DelayManager | undefined;
  protected readonly outputManager: MessageManager<IMessage>;
  protected running = false;
  protected paused = false;
  protected batchBuffer: Array<any> = [];
  protected batchTimer: ReturnType<typeof setTimeout> | null = null;
  protected _processingQueue: Promise<void> = Promise.resolve();

  constructor(options: DriverStreamPipelineBaseOptions) {
    this.logger = options.logger;
    this.stages = options.stages;
    this.inputClass = options.inputClass;
    this.inputTopic = options.inputTopic;
    this.outputClass = options.outputClass;
    this.outputTopic = options.outputTopic;
    this.meta = options.meta;
    this.encryption = options.encryption;
    this.deadLetterManager = options.deadLetterManager;
    this.delayManager = options.delayManager;
    this.outputManager = new MessageManager({
      target: this.outputClass,
      meta: this.meta,
      logger: options.logger,
    });
  }

  abstract start(): Promise<void>;
  abstract resume(): Promise<void>;

  /**
   * Shared pause sequence. Each driver only supplies {@link doPauseConsumer}
   * (its broker-specific consumer teardown); the base owns the ordering that
   * drivers used to re-implement divergently (M8): clear the batch timer, flush
   * any partially-buffered batch, mark paused, then tear the consumer down.
   *
   * The contract is **flush-then-pause**: a paused pipeline must never strand
   * buffered messages, mirroring {@link stop}. Previously kafka/nats/redis
   * flushed on pause but rabbit/memory did not — and rabbit additionally leaked
   * its `batchTimer` (never cleared) — so the same input produced divergent
   * output across drivers. Clearing the timer here fixes that leak everywhere.
   */
  async pause(): Promise<void> {
    if (this.paused) return;

    this.clearBatchTimer();

    // Flush while still running+unpaused so flushBatchBuffer's guard permits it
    // and the partial batch is delivered before input stops.
    await this.flushBatchBuffer();

    this.paused = true;

    await this.doPauseConsumer();

    this.logger.debug("Stream pipeline paused");
  }

  /**
   * Shared stop sequence. Each driver only supplies {@link doStopConsumer} (its
   * broker-specific consumer teardown); the base owns the ordering that every
   * driver duplicated: tear the consumer down, clear the batch timer, flush any
   * buffered batch, then mark stopped.
   */
  async stop(): Promise<void> {
    if (!this.running) return;

    this.paused = false;

    await this.doStopConsumer();

    this.clearBatchTimer();

    await this.flushBatchBuffer();

    this.running = false;

    this.logger.debug("Stream pipeline stopped");
  }

  isRunning(): boolean {
    return this.running && !this.paused;
  }

  protected abstract doPublishEnvelope(
    envelope: IrisEnvelope,
    topic: string,
  ): Promise<void>;

  /**
   * Broker-specific teardown of the running consumer (cancel/close/deregister
   * and clear the cached consumer identifiers). Called by {@link stop}.
   */
  protected abstract doStopConsumer(): Promise<void>;

  /**
   * Broker-specific teardown of the running consumer on {@link pause}. For most
   * drivers this is identical to {@link doStopConsumer} (stop the consumer, drop
   * its identifiers) — they simply delegate. Rabbit additionally unbinds its
   * exclusive queue; memory keeps its subscription (its paused flag gates
   * delivery), so its hook is a no-op.
   */
  protected abstract doPauseConsumer(): Promise<void>;

  protected clearBatchTimer(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = null;
    }
  }

  /**
   * Guard shared by every driver's `start()`: a pipeline cannot consume without
   * a `.from()` input class. Kept here so the (identical) error is raised once.
   */
  protected assertInputClass(): asserts this is this & {
    inputClass: Constructor<IMessage>;
  } {
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
  }

  protected getInputMetadata(): MessageMetadata {
    this.assertInputClass();
    return getMessageMetadata(this.inputClass);
  }

  /**
   * Consume host shared by every driver's `wrap*Consumer` wiring. Deserializing
   * the inbound payload is the pipeline's PARSE step — a failure here is a poison
   * pill routed to `onDeserializationError` (attempt-bounded → dead letter),
   * exactly like a worker queue. Stage/publish failures propagate out of the
   * `callback` (see {@link processStreamMessage}) into the retry/dead-letter path.
   */
  protected buildInboundHost(inputMetadata: MessageMetadata): ConsumerCallbackHost<any> {
    return {
      prepareForConsume: (payload, headers) =>
        prepareInbound(payload, headers, inputMetadata, this.encryption),
      afterConsumeSuccess: async () => {},
      onConsumeError: async () => {},
    };
  }

  /**
   * The consume `callback` handed to `consumeMessageCore` via each driver's
   * `wrap*Consumer`. Runs the transform stages and publishes the output(s).
   *
   * Errors are NOT swallowed — they propagate so the driver's ConsumeStrategies
   * redeliver (bounded by the message's @Retry) and dead-letter on exhaustion,
   * matching the worker-queue at-least-once contract (H5).
   *
   * NOTE on batching: a message that lands in a batch buffer completes its
   * callback (and is therefore acknowledged) BEFORE the batch is flushed and
   * published. Batched pipelines are consequently at-most-once across the
   * buffering window — the flush is decoupled from delivery. Only non-batched
   * pipelines carry the full redelivery/dead-letter guarantee.
   */
  protected processStreamMessage(message: any): Promise<void> {
    if (!this.running || this.paused) return Promise.resolve();

    const run = this._processingQueue.then(() => this.runStages(message));

    // Keep the serialization chain alive but non-rejecting for the NEXT message,
    // while the CURRENT `run` still rejects so consumeMessageCore can retry it.
    this._processingQueue = run.then(
      () => undefined,
      () => undefined,
    );

    return run;
  }

  private async runStages(message: any): Promise<void> {
    if (!this.running || this.paused) return;

    let items: Array<any> = [message];

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
  }

  protected async publishOutput(data: any): Promise<void> {
    const metadata = this.outputManager.metadata;
    const message = this.outputManager.hydrate(data as Record<string, unknown>);
    this.outputManager.validate(message);
    const topic = this.outputTopic ?? resolveDefaultTopic(this.outputManager.metadata);
    const outbound = await prepareOutbound(message, metadata, this.encryption);
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
