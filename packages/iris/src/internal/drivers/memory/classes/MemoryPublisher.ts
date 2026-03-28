import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DelayManager } from "../../../delay/DelayManager";
import type { MemorySharedState } from "../types/memory-store";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase";
import { publishMessages } from "../utils/publish-messages";

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
