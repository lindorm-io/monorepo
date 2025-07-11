import { IMessage } from "@lindorm/message";
import { DeepPartial } from "@lindorm/types";
import { PublishOptions, UnsubscribeOptions } from "../types";
import { IRedisSubscription } from "./RedisSubscription";

export interface IRedisMessageBus<
  M extends IMessage,
  O extends DeepPartial<M> = DeepPartial<M>,
> {
  create(options: O | M): M;
  publish(message: M | Array<M>, options?: PublishOptions): Promise<void>;
  subscribe(
    subscription: IRedisSubscription<M> | Array<IRedisSubscription<M>>,
  ): Promise<void>;
  unsubscribe(
    subscription: UnsubscribeOptions | Array<UnsubscribeOptions>,
  ): Promise<void>;
  unsubscribeAll(): Promise<void>;
}
