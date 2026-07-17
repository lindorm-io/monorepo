import { randomId } from "@lindorm/random";
import type { MemoryEnvelope, MemorySharedState } from "../types/memory-store.js";
import type { IrisEnvelope } from "../../../types/iris-envelope.js";
import { getMessageMetadata } from "../../../message/metadata/get-message-metadata.js";
import { resolveDefaultTopic } from "../../../message/utils/resolve-default-topic.js";
import { dispatchToSubscribers } from "../utils/dispatch-to-subscribers.js";
import { dispatchToConsumers } from "../utils/dispatch-to-consumers.js";
import { wrapConsumerCallback } from "../utils/wrap-consumer-callback.js";
import {
  DriverStreamPipelineBase,
  type DriverStreamPipelineBaseOptions,
} from "../../../classes/DriverStreamPipelineBase.js";

export type MemoryStreamPipelineOptions = DriverStreamPipelineBaseOptions & {
  store: MemorySharedState;
};

export class MemoryStreamPipeline extends DriverStreamPipelineBase {
  private readonly store: MemorySharedState;
  private consumerTag: string | null = null;

  constructor(options: MemoryStreamPipelineOptions) {
    super({
      ...options,
      logger: options.logger.child(["MemoryStreamPipeline"]),
    });
    this.store = options.store;
  }

  async start(): Promise<void> {
    if (this.running) {
      const subscriptionExists =
        this.consumerTag != null &&
        this.store.subscriptions.some((s) => s.consumerTag === this.consumerTag);

      if (subscriptionExists) return;

      this.running = false;
      this.consumerTag = null;
    }

    this.assertInputClass();

    const inputMetadata = getMessageMetadata(this.inputClass);
    const subscribeTopic = this.inputTopic ?? resolveDefaultTopic(inputMetadata);

    this.running = true;
    this.paused = false;
    this.consumerTag = randomId({ namespace: "con", length: 16 });

    this.store.subscriptions.push({
      topic: subscribeTopic,
      queue: null,
      callback: this.buildInboundConsumer(inputMetadata),
      consumerTag: this.consumerTag,
    });

    this.logger.debug("Stream pipeline started", {
      consumerTag: this.consumerTag,
      topic: subscribeTopic,
      stageCount: this.stages.length,
    });
  }

  protected async doStopConsumer(): Promise<void> {
    if (this.consumerTag) {
      this.store.subscriptions = this.store.subscriptions.filter(
        (s) => s.consumerTag !== this.consumerTag,
      );
      this.consumerTag = null;
    }
  }

  // Memory tracks its timers in the shared store so teardown can drain them; the
  // base clearBatchTimer is extended to also drop the store reference.
  protected override clearBatchTimer(): void {
    if (this.batchTimer) {
      this.store.timers.delete(this.batchTimer);
    }
    super.clearBatchTimer();
  }

  // Memory keeps its subscription on pause — the base's `paused` flag gates
  // delivery (processStreamMessage early-returns while paused) — so there is no
  // consumer to tear down. The base still clears the batch timer and flushes any
  // partial batch on pause (M8), matching every other driver.
  protected async doPauseConsumer(): Promise<void> {
    // No-op: nothing to tear down.
  }

  async resume(): Promise<void> {
    this.paused = false;
    this.logger.debug("Stream pipeline resumed");
  }

  // Route inbound stream messages through the SAME consume machinery as the
  // memory worker queue: deserialize (parse errors → dead letter) then run the
  // transform stages (failures → retry bounded by @Retry, then dead letter).
  private buildInboundConsumer(
    inputMetadata: ReturnType<typeof getMessageMetadata>,
  ): (envelope: MemoryEnvelope) => Promise<void> {
    return wrapConsumerCallback(
      this.buildInboundHost(inputMetadata),
      (message) => this.processStreamMessage(message),
      this.store,
      inputMetadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );
  }

  protected async doPublishEnvelope(
    envelope: IrisEnvelope,
    _topic: string,
  ): Promise<void> {
    await dispatchToSubscribers(this.store, envelope);
    await dispatchToConsumers(this.store, envelope);
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
