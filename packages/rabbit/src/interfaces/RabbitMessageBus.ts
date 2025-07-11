import { IMessage, SubscribeOptions, UnsubscribeOptions } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { PublishOptions } from "../types";

export interface IRabbitMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(
    subscription: SubscribeOptions<M> | Array<SubscribeOptions<M>>,
  ): Promise<void>;
  unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
