import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DelayManager } from "../../../delay/DelayManager";
import type { KafkaSharedState } from "../types/kafka-types";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase";
import { publishKafkaMessages } from "../utils/publish-kafka-messages";

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
