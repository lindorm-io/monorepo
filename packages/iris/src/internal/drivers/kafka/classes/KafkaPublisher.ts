import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { KafkaSharedState } from "../types/kafka-types.js";
import {
  DriverPublisherBase,
  type DriverPublisherBaseSettings,
} from "../../../classes/DriverPublisherBase.js";
import { publishKafkaMessages } from "../utils/publish-kafka-messages.js";

export type KafkaPublisherSettings<M extends IMessage> =
  DriverPublisherBaseSettings<M> & {
    state: KafkaSharedState;
    delayManager?: DelayManager;
  };

export class KafkaPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: KafkaSharedState;
  private readonly delayManager: DelayManager | undefined;

  constructor(options: KafkaPublisherSettings<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishKafkaMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
        warnPriorityUnsupportedOnce: (priority) =>
          this.warnPriorityUnsupportedOnce(priority),
      },
      this.state,
      this.logger,
      { delayManager: this.delayManager },
    );
  }
}
