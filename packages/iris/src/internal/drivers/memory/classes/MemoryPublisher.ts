import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { MemorySharedState } from "../types/memory-store.js";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase.js";
import { publishMessages } from "../utils/publish-messages.js";

export type MemoryPublisherOptions<M extends IMessage> = DriverBaseOptions<M> & {
  store: MemorySharedState;
  delayManager?: DelayManager;
};

export class MemoryPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly store: MemorySharedState;
  private readonly delayManager: DelayManager | undefined;

  public constructor(options: MemoryPublisherOptions<M>) {
    super(options);
    this.store = options.store;
    this.delayManager = options.delayManager;
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
}
