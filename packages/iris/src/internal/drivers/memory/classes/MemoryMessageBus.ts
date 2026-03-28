import { randomUUID } from "@lindorm/random";
import type { IMessage } from "../../../../interfaces";
import type { PublishOptions, SubscribeOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DeadLetterManager } from "../../../dead-letter/DeadLetterManager";
import type { DelayManager } from "../../../delay/DelayManager";
import type { MemorySharedState } from "../types/memory-store";
import { DriverMessageBusBase } from "../../../classes/DriverMessageBusBase";
import { publishMessages } from "../utils/publish-messages";
import { wrapConsumerCallback } from "../utils/wrap-consumer-callback";

export type MemoryMessageBusOptions<M extends IMessage> = DriverBaseOptions<M> & {
  store: MemorySharedState;
  delayManager?: DelayManager;
  deadLetterManager?: DeadLetterManager;
};

export class MemoryMessageBus<M extends IMessage> extends DriverMessageBusBase<M> {
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;
  private readonly deadLetterManager: DeadLetterManager | undefined;
  private readonly ownedConsumerTags: Set<string> = new Set();

  public constructor(options: MemoryMessageBusOptions<M>) {
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

  public async subscribe(
    options: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void> {
    if (Array.isArray(options)) {
      for (const opt of options) {
        await this.subscribe(opt);
      }
      return;
    }

    const consumerTag = randomUUID();
    this.ownedConsumerTags.add(consumerTag);

    const wrappedCallback = wrapConsumerCallback(
      {
        prepareForConsume: (payload, headers) => this.prepareForConsume(payload, headers),
        afterConsumeSuccess: (msg) => this.afterConsumeSuccess(msg),
        onConsumeError: (err, msg) => this.onConsumeError(err, msg),
      },
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
  }

  public async unsubscribe(options: { topic: string; queue?: string }): Promise<void> {
    const toRemove: Array<number> = [];

    for (let i = 0; i < this.store.subscriptions.length; i++) {
      const sub = this.store.subscriptions[i];
      if (sub.topic !== options.topic) continue;
      if (options.queue !== undefined && sub.queue !== options.queue) continue;
      if (!this.ownedConsumerTags.has(sub.consumerTag)) continue;
      toRemove.push(i);
    }

    for (let i = toRemove.length - 1; i >= 0; i--) {
      const sub = this.store.subscriptions[toRemove[i]];
      this.ownedConsumerTags.delete(sub.consumerTag);
      this.store.subscriptions.splice(toRemove[i], 1);
    }
  }

  public async unsubscribeAll(): Promise<void> {
    this.store.subscriptions = this.store.subscriptions.filter(
      (sub) => !this.ownedConsumerTags.has(sub.consumerTag),
    );
    this.ownedConsumerTags.clear();
  }
}
