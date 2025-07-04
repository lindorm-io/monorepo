import { IMessage } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { PublishOptions, UnsubscribeOptions } from "../types";
import { IRabbitSubscription } from "./RabbitSubscription";

export interface IRabbitMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
  ): Promise<void>;
  unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
