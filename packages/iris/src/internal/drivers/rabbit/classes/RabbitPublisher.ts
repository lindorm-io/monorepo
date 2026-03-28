import type { IMessage } from "../../../../interfaces";
import type { PublishOptions } from "../../../../types";
import type { DriverBaseOptions } from "../../../classes/DriverBase";
import type { RabbitSharedState } from "../types/rabbit-types";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase";
import { publishRabbitMessages } from "../utils/publish-messages";

export type RabbitPublisherOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RabbitSharedState;
};

export class RabbitPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: RabbitSharedState;

  public constructor(options: RabbitPublisherOptions<M>) {
    super(options);
    this.state = options.state;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRabbitMessages(
      message,
      options,
      {
        prepareForPublish: (msg) => this.prepareForPublish(msg),
        completePublish: (msg) => this.completePublish(msg),
        metadata: this.metadata,
      },
      this.state,
      this.logger,
    );
  }
}
