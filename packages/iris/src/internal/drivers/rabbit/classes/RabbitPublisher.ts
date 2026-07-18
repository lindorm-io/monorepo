import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { RabbitSharedState } from "../types/rabbit-types.js";
import {
  DriverPublisherBase,
  type DriverPublisherBaseOptions,
} from "../../../classes/DriverPublisherBase.js";
import { publishRabbitMessages } from "../utils/publish-messages.js";

export type RabbitPublisherOptions<M extends IMessage> = DriverPublisherBaseOptions<M> & {
  state: RabbitSharedState;
};

export class RabbitPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: RabbitSharedState;

  constructor(options: RabbitPublisherOptions<M>) {
    super(options);
    this.state = options.state;
  }

  async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRabbitMessages(
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
    );
  }
}
