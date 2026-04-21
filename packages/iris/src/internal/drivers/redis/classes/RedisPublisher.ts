import type { IMessage } from "../../../../interfaces/index.js";
import type { PublishOptions } from "../../../../types/index.js";
import type { DriverBaseOptions } from "../../../classes/DriverBase.js";
import type { DelayManager } from "../../../delay/DelayManager.js";
import type { RedisSharedState } from "../types/redis-types.js";
import { DriverPublisherBase } from "../../../classes/DriverPublisherBase.js";
import { publishRedisMessages } from "../utils/publish-redis-messages.js";

export type RedisPublisherOptions<M extends IMessage> = DriverBaseOptions<M> & {
  state: RedisSharedState;
  delayManager?: DelayManager;
};

export class RedisPublisher<M extends IMessage> extends DriverPublisherBase<M> {
  private readonly state: RedisSharedState;
  private readonly delayManager: DelayManager | undefined;

  public constructor(options: RedisPublisherOptions<M>) {
    super(options);
    this.state = options.state;
    this.delayManager = options.delayManager;
  }

  public async publish(message: M | Array<M>, options?: PublishOptions): Promise<void> {
    await publishRedisMessages(
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
