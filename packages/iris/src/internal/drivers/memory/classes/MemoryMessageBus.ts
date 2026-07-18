import { lindormId } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions, SubscribeOptions } from "../../../../types/index.js";
import {
  DriverMessageBusBase,
  type DriverMessageBusBaseOptions,
} from "../../../classes/DriverMessageBusBase.js";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { MemorySharedState } from "../types/memory-store.js";
import { publishMessages } from "../utils/publish-messages.js";
import { wrapConsumerCallback } from "../utils/wrap-consumer-callback.js";

export type MemoryMessageBusOptions<M extends IMessage> =
  DriverMessageBusBaseOptions<M> & {
    store: MemorySharedState;
    delayManager?: DelayManager;
    deadLetterManager?: DeadLetterManager;
  };

type OwnedSubscription = {
  consumerTag: string;
};

export class MemoryMessageBus<M extends IMessage> extends DriverMessageBusBase<
  M,
  OwnedSubscription
> {
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;

  constructor(options: MemoryMessageBusOptions<M>) {
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

  protected async subscribeOne(options: SubscribeOptions<M>): Promise<OwnedSubscription> {
    const consumerTag = lindormId({ namespace: "con", length: 16 });

    const wrappedCallback = wrapConsumerCallback(
      this.consumerHooks(),
      options.callback,
      this.store,
      this.metadata,
      this.logger,
      { deadLetterManager: this.deadLetterManager },
    );

    this.store.subscriptions.push({
      topic: options.topic,
      queue: options.queue ?? null,
      callback: wrappedCallback,
      consumerTag,
    });

    return { consumerTag };
  }

  protected async teardownSubscription(sub: OwnedSubscription): Promise<void> {
    const index = this.store.subscriptions.findIndex(
      (s) => s.consumerTag === sub.consumerTag,
    );
    if (index !== -1) this.store.subscriptions.splice(index, 1);
  }
}
