import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { DelayManager } from "../../../delay/DelayManager";
import type { NatsSharedState } from "../types/nats-types";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase";
import { publishNatsMessages } from "../utils/publish-nats-messages";

export type NatsPublisherOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: NatsSharedState;
  delayManager?: DelayManager;
};

export class NatsPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: NatsSharedState;
  private readonly delayManager: DelayManager | undefined;

  public constructor(options: NatsPublisherOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishNatsMessages(
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
