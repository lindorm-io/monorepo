import { lindormId } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces/index.js";
import type { ConsumeEnvelope, PublishOptions } from "../../../../types/index.js";
import {
  DriverWorkerQueueBase,
  type DriverWorkerQueueBaseSettings,
} from "../../../classes/DriverWorkerQueueBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import { resolveConsumeTopic } from "../../../message/utils/resolve-consume-topic.js";
import type { MemorySharedState } from "../types/memory-store.js";
import { publishMessages } from "../utils/publish-messages.js";
import { wrapConsumerCallback } from "../utils/wrap-consumer-callback.js";

export type MemoryWorkerQueueSettings<M extends IMessage> =
  DriverWorkerQueueBaseSettings<M> & {
    store: MemorySharedState;
    delayManager?: DelayManager;
    deadLetterManager?: DeadLetterManager;
  };

type OwnedConsumer = {
  consumerTag: string;
};

export class MemoryWorkerQueue<M extends IMessage> extends DriverWorkerQueueBase<
  M,
  OwnedConsumer
> {
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: MemoryWorkerQueueSettings<M>) {
    super(options);
    this.store = options.store;
    this.delayManager = options.delayManager;
    this.deadLetterManager = options.deadLetterManager;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
        warnPriorityUnsupportedOnce: (priority) =>
          this.warnPriorityUnsupportedOnce(priority),
      },
      this.store,
      { delayManager: this.delayManager },
    );
  }

  protected async consumeOne(
    queue: string,
    callback: (message: M, envelope: ConsumeEnvelope) => Promise<void>,
  ): Promise<OwnedConsumer> {
    const consumerTag = lindormId({ namespace: "con", length: 16 });

    const wrappedCallback = wrapConsumerCallback(
      this.consumerHooks(),
      callback,
      this.store,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    this.store.consumers.push({
      topic: resolveConsumeTopic(this.metadata, this.logger, queue),
      queue,
      callback: wrappedCallback,
      consumerTag,
    });

    return { consumerTag };
  }

  protected async teardownConsumer(consumer: OwnedConsumer): Promise<void> {
    const index = this.store.consumers.findIndex(
      (c) => c.consumerTag === consumer.consumerTag,
    );
    if (index !== -1) this.store.consumers.splice(index, 1);
  }
}
