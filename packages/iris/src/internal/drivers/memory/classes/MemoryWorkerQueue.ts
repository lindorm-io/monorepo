import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { ConsumeEnvelope, ConsumeOptions, PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { MemorySharedState } from "../types/memory-store";
import { IrisDriverError } from "../../../../errors/IrisDriverError";
import { DriverWorkerQueueBase } from "../../../classes/DriverWorkerQueueBase";
import { publishMessages } from "../utils/publish-messages";
import { wrapConsumerCallback } from "../utils/wrap-consumer-callback";

export type MemoryWorkerQueueOptions<M extends IMessage> = DriverBaseOptions<M> & {
  store: MemorySharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class MemoryWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<M> {
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumerTags: Set<string> = new Set();

  public constructor(options: MemoryWorkerQueueOptions<M>) {
    super(options);
    this.store = options.store;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
      },
      this.store,
      { delayManager: this.delayManager },
    );
  }

  public async consume(
    queueOrOptions: string | ConsumeOptions<M> | Array<ConsumeOptions<M>>,
    callback?: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<void> {
    if (Array.isArray(queueOrOptions)) {
      for (const opt of queueOrOptions) {
        await this.consume(opt);
      }
      return;
    }

    const queue =
      typeof queueOrOptions === "string" ? queueOrOptions : queueOrOptions.queue;
    const cb = typeof queueOrOptions === "string" ? callback : queueOrOptions.callback;

    if (!cb) {
      throw new IrisDriverError("consume() requires a callback");
    }

    const consumerTag = randomUUID();
    this.ownedConsumerTags.add(consumerTag);

    const wrappedCallback = wrapConsumerCallback(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
      cb,
      this.store,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    this.store.consumers.push({
      topic: queue,
      callback: wrappedCallback,
      consumerTag,
    });
  }

  public async unconsume(queue: string): Promise<void> {
    const toRemove: Array<number> = [];

    for (let i = 0; i < this.store.consumers.length; i++) {
      const consumer = this.store.consumers[i];
      if (consumer.topic !== queue) continue;
      if (!this.ownedConsumerTags.has(consumer.consumerTag)) continue;
      toRemove.push(i);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const consumer = this.store.consumers[toRemove[i]];
      this.ownedConsumerTags.delete(consumer.consumerTag);
      this.store.consumers.splice(toRemove[i], 1);
    }
  }

  public async unconsumeAll(): Promise<void> {
    this.store.consumers = this.store.consumers.filter(
      (consumer) => !this.ownedConsumerTags.has(consumer.consumerTag),
    );
    this.ownedConsumerTags.clear();
  }
}
