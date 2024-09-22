import { DeepPartial } from "@lindorm/types";
import { UnsubscribeOptions } from "../types";
import { IRabbitMessage } from "./RabbitMessage";
import { IRabbitSubscription } from "./RabbitSubscription";

export interface IRabbitMessageBus<
  M extends IRabbitMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  publish(message: M | Array<M>): Promise<void>;
  subscribe(
    subscription: IRabbitSubscription<M> | Array<IRabbitSubscription<M>>,
  ): Promise<void>;
  unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
