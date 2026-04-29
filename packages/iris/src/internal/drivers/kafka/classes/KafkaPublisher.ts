import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase.js";
import { publishKafkaMessages } from "../utils/publish-kafka-messages.js";

export type KafkaPublisherOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: KafkaSharedState;
  delayManager?: DelayManager;
};

export class KafkaPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;

  public constructor(options: KafkaPublisherOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishKafkaMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }
}
